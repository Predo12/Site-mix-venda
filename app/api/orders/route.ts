import { priceOrderItems, type OrderItemInput } from "@/lib/catalog";
import { requireApiRole } from "@/lib/admin-auth";
import { sendOrderEmail } from "@/lib/order-email";
import { cleanText, digits, getD1, getDeliveryZones, jsonError } from "@/lib/server-data";
import { findZone, STORE } from "@/lib/store-config";

export const dynamic = "force-dynamic";

type OrderBody = {
  customerName?: string;
  customerPhone?: string;
  fulfillmentType?: "delivery" | "pickup";
  cep?: string;
  street?: string;
  streetNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  notes?: string;
  paymentMethod?: "pix" | "credit" | "debit";
  ageConfirmed?: boolean;
  items?: OrderItemInput[];
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as OrderBody | null;
  if (!body) return jsonError("Não foi possível ler o pedido.");
  const customerName = cleanText(body.customerName, 80);
  const customerPhone = digits(body.customerPhone);
  const fulfillmentType = body.fulfillmentType === "pickup" ? "pickup" : "delivery";
  const paymentMethod = body.paymentMethod;
  if (customerName.length < 2) return jsonError("Informe seu nome.");
  if (customerPhone.length < 10 || customerPhone.length > 13) return jsonError("Informe um WhatsApp válido.");
  if (!body.ageConfirmed) return jsonError("A confirmação de maioridade é obrigatória.");
  if (!paymentMethod || !["pix", "credit", "debit"].includes(paymentMethod)) return jsonError("Escolha a forma de pagamento.");

  let items;
  try {
    items = priceOrderItems(body.items ?? []);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Revise os itens do pedido.");
  }
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  let cep = "";
  let street = "";
  let streetNumber = "";
  let complement = "";
  let neighborhood = "";
  let city = "";
  let deliveryFeeCents = 0;
  if (fulfillmentType === "delivery") {
    cep = digits(body.cep);
    streetNumber = cleanText(body.streetNumber, 20);
    complement = cleanText(body.complement, 80);
    if (cep.length !== 8 || !streetNumber) return jsonError("Preencha o endereço completo.");
    let verifiedAddress: { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string };
    try {
      const cepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      verifiedAddress = await cepResponse.json() as typeof verifiedAddress;
      if (!cepResponse.ok || verifiedAddress.erro) throw new Error("CEP inválido");
    } catch {
      return jsonError("Não foi possível validar o CEP. Tente novamente.", 503);
    }
    street = cleanText(verifiedAddress.logradouro || body.street, 120);
    neighborhood = cleanText(verifiedAddress.bairro, 80);
    city = cleanText(verifiedAddress.localidade, 80);
    if (city !== "Campo Grande" || !street || !neighborhood) return jsonError("Este endereço não pertence à área atendida.");
    const zone = findZone(await getDeliveryZones(), neighborhood);
    if (!zone) return jsonError("Este endereço ainda não está na área de entrega. Consulte pelo WhatsApp.");
    deliveryFeeCents = zone.feeCents;
  }

  const paymentFeeCents = paymentMethod === "pix" ? 0 : STORE.cardFeeCents;
  const totalCents = subtotalCents + deliveryFeeCents + paymentFeeCents;
  const id = crypto.randomUUID();
  const orderNumber = `MIX-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${id.slice(0, 4).toUpperCase()}`;
  const now = Date.now();
  const db = getD1();
  await db.batch([
    db.prepare(`INSERT INTO orders (
      id, order_number, customer_name, customer_phone, fulfillment_type, cep, street, street_number, complement,
      neighborhood, city, items_json, subtotal_cents, delivery_fee_cents, payment_method, payment_fee_cents,
      total_cents, notes, age_confirmed, age_confirmed_at, status, eta_min, eta_max, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`)
      .bind(id, orderNumber, customerName, customerPhone, fulfillmentType, cep || null, street || null, streetNumber || null, complement || null, neighborhood || null, city || null, JSON.stringify(items), subtotalCents, deliveryFeeCents, paymentMethod, paymentFeeCents, totalCents, cleanText(body.notes, 500) || null, 1, now, STORE.etaMin, STORE.etaMax, now, now),
    db.prepare("INSERT INTO order_events (order_id, actor_email, action, from_status, to_status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, customerPhone, "created", null, "new", now),
  ]);

  const address = fulfillmentType === "pickup" ? `Retirada em ${STORE.address}` : `${street}, ${streetNumber}${complement ? ` — ${complement}` : ""}, ${neighborhood}, ${city} — CEP ${cep}`;
  const email = await sendOrderEmail({ orderNumber, customerName, customerPhone, fulfillmentType: fulfillmentType === "pickup" ? "Retirada" : "Entrega", paymentMethod, address, items, deliveryFeeCents, paymentFeeCents, totalCents }).catch(() => ({ sent: false, reason: "provider_error" as const }));
  return Response.json({ order: { id, orderNumber, customerName, customerPhone, items, subtotalCents, deliveryFeeCents, paymentFeeCents, totalCents, fulfillmentType, address, paymentMethod, etaMin: STORE.etaMin, etaMax: STORE.etaMax }, email }, { status: 201 });
}

export async function GET() {
  const identity = await requireApiRole();
  if (!identity) return jsonError("Acesso restrito.", 403);
  const result = await getD1().prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all<Record<string, unknown>>();
  return Response.json({ orders: result.results.map(mapOrderRow), viewer: identity });
}

function mapOrderRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    fulfillmentType: row.fulfillment_type,
    cep: row.cep,
    street: row.street,
    streetNumber: row.street_number,
    complement: row.complement,
    neighborhood: row.neighborhood,
    city: row.city,
    items: JSON.parse(String(row.items_json || "[]")),
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    paymentMethod: row.payment_method,
    paymentFeeCents: row.payment_fee_cents,
    totalCents: row.total_cents,
    notes: row.notes,
    ageConfirmed: Boolean(row.age_confirmed),
    status: row.status,
    etaMin: row.eta_min,
    etaMax: row.eta_max,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
