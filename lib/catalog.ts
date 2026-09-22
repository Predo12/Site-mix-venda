export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: "Destaques" | "Clássicos" | "Sem álcool";
  badge?: string;
  gradient: string;
  icon: "martini" | "wine" | "water";
};

export type CustomDrink = {
  alcoholMode: "alcoholic" | "non_alcoholic";
  bases: string[];
  fruits: string[];
  extras: string[];
  sweetness: "sweetened" | "unsweetened";
};

export type OrderItemInput = {
  id: string;
  name: string;
  quantity: number;
  custom?: CustomDrink;
};

export type PricedOrderItem = OrderItemInput & {
  unitPriceCents: number;
  details?: string;
};

export const products: Product[] = [
  { id: "ruby-tonic", name: "Ruby Tonic", description: "Gin, frutas vermelhas, tônica e toque cítrico.", priceCents: 2900, category: "Destaques", badge: "Mais pedido", gradient: "from-[#8d1022] via-[#c62d32] to-[#f07a28]", icon: "martini" },
  { id: "caipirinha", name: "Caipirinha da casa", description: "Cachaça, limão tahiti, açúcar e gelo.", priceCents: 1800, category: "Destaques", badge: "Clássico", gradient: "from-[#58641d] via-[#98a73a] to-[#e8a52b]", icon: "wine" },
  { id: "mojito", name: "Mojito", description: "Rum, hortelã, limão e água com gás.", priceCents: 2200, category: "Clássicos", gradient: "from-[#174733] via-[#377a57] to-[#9bb761]", icon: "wine" },
  { id: "sunset", name: "Sunset Mule", description: "Vodka, espuma de gengibre e laranja.", priceCents: 2700, category: "Clássicos", gradient: "from-[#a72a19] via-[#e35b22] to-[#ffad36]", icon: "martini" },
  { id: "tropical-zero", name: "Tropical Zero", description: "Abacaxi, maracujá, limão e água com gás.", priceCents: 1600, category: "Sem álcool", badge: "0% álcool", gradient: "from-[#b85d13] via-[#e7941f] to-[#f7d048]", icon: "water" },
  { id: "berry-soda", name: "Berry Soda", description: "Morango, frutas vermelhas e soda artesanal.", priceCents: 1700, category: "Sem álcool", gradient: "from-[#6f1741] via-[#b02358] to-[#ed7186]", icon: "water" },
];

export const alcoholicBases = [
  { name: "Cachaça", priceCents: 1200 },
  { name: "Vodka", priceCents: 1500 },
  { name: "Rum", priceCents: 1500 },
  { name: "Saquê", priceCents: 1800 },
  { name: "Gin", priceCents: 1800 },
  { name: "Tequila", priceCents: 2000 },
  { name: "Whisky", priceCents: 2000 },
];

export const nonAlcoholicBases = [
  { name: "Água com gás", priceCents: 600 },
  { name: "Refrigerante", priceCents: 700 },
  { name: "Suco de laranja", priceCents: 800 },
  { name: "Energético", priceCents: 1200 },
];

export const fruits = [
  { name: "Limão", priceCents: 200 },
  { name: "Morango", priceCents: 300 },
  { name: "Maracujá", priceCents: 300 },
  { name: "Abacaxi", priceCents: 300 },
  { name: "Kiwi", priceCents: 400 },
  { name: "Laranja", priceCents: 300 },
];

export const extras = [
  { name: "Gelo", priceCents: 0 },
  { name: "Hortelã", priceCents: 200 },
  { name: "Espuma de gengibre", priceCents: 400 },
  { name: "Soda", priceCents: 400 },
  { name: "Refrigerante", priceCents: 400 },
];

export function priceOrderItems(items: OrderItemInput[]): PricedOrderItem[] {
  if (!Array.isArray(items) || items.length === 0 || items.length > 40) throw new Error("Pedido sem itens válidos.");

  return items.map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("Quantidade inválida no pedido.");

    if (!item.id.startsWith("custom-")) {
      const product = products.find((candidate) => candidate.id === item.id);
      if (!product) throw new Error("Um produto do pedido não existe mais.");
      return { id: product.id, name: product.name, quantity, unitPriceCents: product.priceCents };
    }

    const custom = item.custom;
    if (!custom || !["alcoholic", "non_alcoholic"].includes(custom.alcoholMode)) throw new Error("Escolha se o drink é com ou sem álcool.");
    const availableBases = custom.alcoholMode === "alcoholic" ? alcoholicBases : nonAlcoholicBases;
    if (!Array.isArray(custom.bases) || custom.bases.length < 1 || custom.bases.length > 2 || new Set(custom.bases).size !== custom.bases.length) throw new Error("Escolha uma ou duas bebidas-base.");
    const selectedBases = custom.bases.map((name) => availableBases.find((candidate) => candidate.name === name));
    if (selectedBases.some((base) => !base)) throw new Error("Uma das bebidas-base escolhidas é inválida.");
    if (!Array.isArray(custom.fruits) || custom.fruits.length < 1 || custom.fruits.length > 3) throw new Error("Escolha de uma a três frutas.");
    const selectedFruits = custom.fruits.map((name) => fruits.find((candidate) => candidate.name === name));
    if (selectedFruits.some((fruit) => !fruit)) throw new Error("Uma das frutas escolhidas é inválida.");
    if (!Array.isArray(custom.extras) || custom.extras.length < 1 || custom.extras.length > extras.length || new Set(custom.extras).size !== custom.extras.length) throw new Error("Escolha pelo menos um complemento.");
    const selectedExtras = custom.extras.map((name) => extras.find((candidate) => candidate.name === name));
    if (selectedExtras.some((extra) => !extra)) throw new Error("Um dos complementos escolhidos é inválido.");
    if (!custom.sweetness || !["sweetened", "unsweetened"].includes(custom.sweetness)) throw new Error("Escolha se o drink será adoçado.");
    const unitPriceCents = selectedBases.reduce((sum, base) => sum + (base?.priceCents ?? 0), 0) + selectedFruits.reduce((sum, fruit) => sum + (fruit?.priceCents ?? 0), 0) + selectedExtras.reduce((sum, extra) => sum + (extra?.priceCents ?? 0), 0);
    if (unitPriceCents <= 0) throw new Error("O drink precisa ter uma bebida-base.");
    return {
      id: item.id,
      name: String(item.name || "Meu drink").slice(0, 40),
      quantity,
      unitPriceCents,
      details: [custom.alcoholMode === "alcoholic" ? "Com álcool" : "Sem álcool", ...custom.bases, ...custom.fruits, ...custom.extras, custom.sweetness === "sweetened" ? "Adoçado" : "Sem açúcar"].join(" + "),
      custom,
    };
  });
}

export function formatMoneyFromCents(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
