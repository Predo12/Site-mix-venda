export type DeliveryZone = { neighborhood: string; feeCents: number; active: boolean };

export const STORE = {
  name: "Mixology Drinkeria",
  whatsappDigits: "5567992822336",
  notificationEmail: "gotreks12@gmail.com",
  address: "Rua dos Caiabis, 216 — Jardim Imá — Campo Grande/MS",
  cep: "79102-240",
  etaMin: 40,
  etaMax: 60,
  cardFeeCents: 250,
  openingDays: [3, 4, 5, 6, 0],
  openingLabel: "Quarta a domingo, das 19h à 00h",
};

export const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [
  { neighborhood: "Jardim Imá", feeCents: 600, active: true },
  { neighborhood: "Jardim Petrópolis", feeCents: 700, active: true },
  { neighborhood: "Vila Sílvia Regina", feeCents: 800, active: true },
  { neighborhood: "Santo Antônio", feeCents: 900, active: true },
  { neighborhood: "Vila Palmira", feeCents: 1000, active: true },
  { neighborhood: "Vila Almeida", feeCents: 1200, active: true },
];

export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function findZone(zones: DeliveryZone[], neighborhood: string) {
  const normalized = normalizeText(neighborhood);
  return zones.find((zone) => zone.active && normalizeText(zone.neighborhood) === normalized) ?? null;
}

export function storeIsOpen(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Campo_Grande",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = weekday ? dayMap[weekday] : -1;
  return STORE.openingDays.includes(day) && hour >= 19;
}
