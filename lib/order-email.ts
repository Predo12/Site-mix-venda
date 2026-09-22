import { env } from "cloudflare:workers";

import { formatMoneyFromCents, type PricedOrderItem } from "@/lib/catalog";
import { STORE } from "@/lib/store-config";

type EmailOrder = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: string;
  paymentMethod: string;
  address: string;
  items: PricedOrderItem[];
  deliveryFeeCents: number;
  paymentFeeCents: number;
  totalCents: number;
};

export async function sendOrderEmail(order: EmailOrder) {
  const apiKey = (env as unknown as { RESEND_API_KEY?: string }).RESEND_API_KEY;
  const from = (env as unknown as { ORDER_FROM_EMAIL?: string }).ORDER_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, reason: "not_configured" as const };

  const itemRows = order.items
    .map((item) => `<li>${item.quantity}× ${escapeHtml(item.name)} — ${formatMoneyFromCents(item.unitPriceCents * item.quantity)}${item.details ? `<br><small>${escapeHtml(item.details)}</small>` : ""}</li>`)
    .join("");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [STORE.notificationEmail],
      subject: `Novo pedido ${order.orderNumber} — ${order.customerName}`,
      html: `<h2>Novo pedido ${escapeHtml(order.orderNumber)}</h2><p><strong>Cliente:</strong> ${escapeHtml(order.customerName)} — ${escapeHtml(order.customerPhone)}</p><p><strong>Recebimento:</strong> ${escapeHtml(order.fulfillmentType)}<br><strong>Endereço:</strong> ${escapeHtml(order.address)}<br><strong>Pagamento:</strong> ${escapeHtml(order.paymentMethod)}</p><ul>${itemRows}</ul><p>Entrega: ${formatMoneyFromCents(order.deliveryFeeCents)}<br>Taxa do cartão: ${formatMoneyFromCents(order.paymentFeeCents)}<br><strong>Total: ${formatMoneyFromCents(order.totalCents)}</strong></p>`,
    }),
  });
  return { sent: response.ok, reason: response.ok ? "sent" as const : "provider_error" as const };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}
