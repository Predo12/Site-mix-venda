"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, Cookie, GlassWater, MapPin, Martini, Menu, MessageCircle, Minus, Plus, Search, Send, ShoppingBag, Sparkles, Truck, Wine, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { alcoholicBases, extras, formatMoneyFromCents, fruits, nonAlcoholicBases, products, type CustomDrink, type Product } from "@/lib/catalog";
import { DEFAULT_DELIVERY_ZONES, STORE, findZone, type DeliveryZone } from "@/lib/store-config";

type CartItem = {
  id: string; name: string; description: string; priceCents: number; quantity: number;
  category: Product["category"]; gradient: string; icon: Product["icon"];
  details?: string; custom?: CustomDrink;
};
type PublicConfig = { zones: DeliveryZone[]; cardFeeCents: number; etaMin: number; etaMax: number; openingLabel: string; storeAddress: string; whatsappDigits: string };
type OrderResult = { orderNumber: string; customerName: string; customerPhone: string; items: Array<{ name: string; quantity: number; unitPriceCents: number; details?: string }>; subtotalCents: number; deliveryFeeCents: number; paymentFeeCents: number; totalCents: number; fulfillmentType: string; address: string; paymentMethod: string; etaMin: number; etaMax: number };
type ChatMessage = { id: number; senderType: string; senderName: string; body: string; createdAt: number };

const categories = ["Todos", "Destaques", "Clássicos", "Sem álcool"] as const;
const defaultConfig: PublicConfig = { zones: DEFAULT_DELIVERY_ZONES, cardFeeCents: STORE.cardFeeCents, etaMin: STORE.etaMin, etaMax: STORE.etaMax, openingLabel: STORE.openingLabel, storeAddress: STORE.address, whatsappDigits: STORE.whatsappDigits };

export function Storefront() {
  const [category, setCategory] = useState<(typeof categories)[number]>("Todos");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState<OrderResult | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
  const [payment, setPayment] = useState<"pix" | "credit" | "debit">("pix");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [address, setAddress] = useState({ cep: "", street: "", number: "", complement: "", neighborhood: "", city: "" });
  const [addressState, setAddressState] = useState<"idle" | "loading" | "served" | "unserved" | "error">("idle");
  const [alcoholMode, setAlcoholMode] = useState<CustomDrink["alcoholMode"] | null>(null);
  const [selectedBases, setSelectedBases] = useState<Array<{ name: string; priceCents: number }>>([]);
  const [selectedFruits, setSelectedFruits] = useState<typeof fruits>([]);
  const [selectedExtras, setSelectedExtras] = useState<typeof extras>([]);
  const [sweetness, setSweetness] = useState<CustomDrink["sweetness"] | null>(null);
  const [drinkName, setDrinkName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cookiePreferencesOpen, setCookiePreferencesOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mixology-cart-v4");
      if (saved) setCart(JSON.parse(saved));
    } catch { /* O carrinho continua funcionando nesta sessão. */ }
    setHydrated(true);
    fetch("/api/config", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<PublicConfig> : null).then((data) => data && setConfig(data)).catch(() => undefined);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem("mixology-cart-v4", JSON.stringify(cart)); }, [cart, hydrated]);

  const addProduct = (product: Product, openCart = false) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, quantity: 1 }];
    });
    toast.success(`${product.name} foi para o carrinho`);
    if (openCart) setCartOpen(true);
  };

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void context.registerTool({
      name: "add_menu_item_to_cart",
      title: "Adicionar drink ao carrinho",
      description: "Adiciona ao carrinho um drink existente do cardápio da Mixology.",
      inputSchema: { type: "object", properties: { productId: { type: "string", enum: products.map((product) => product.id) } }, required: ["productId"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input: unknown) => {
        const product = products.find((candidate) => candidate.id === (input as { productId?: string })?.productId);
        if (!product) throw new Error("Drink não encontrado no cardápio.");
        addProduct(product);
        return { added: product.name, priceCents: product.priceCents };
      },
    }, { signal: lifecycle.signal });
    return () => lifecycle.abort();
  }, []);

  const activeBases = alcoholMode === "alcoholic" ? alcoholicBases : alcoholMode === "non_alcoholic" ? nonAlcoholicBases : [];
  const customTotal = selectedBases.reduce((sum, base) => sum + base.priceCents, 0) + selectedFruits.reduce((sum, fruit) => sum + fruit.priceCents, 0) + selectedExtras.reduce((sum, extra) => sum + extra.priceCents, 0);
  const customReady = Boolean(alcoholMode && selectedBases.length && selectedFruits.length && selectedExtras.length && sweetness);
  const addCustomDrink = () => {
    if (!alcoholMode || !selectedBases.length || !selectedExtras.length || !selectedFruits.length || !sweetness) return;
    const custom: CustomDrink = { alcoholMode, bases: selectedBases.map((base) => base.name), fruits: selectedFruits.map((fruit) => fruit.name), extras: selectedExtras.map((extra) => extra.name), sweetness };
    const item: CartItem = { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: drinkName.trim() || "Meu drink", description: "Drink personalizado", details: [alcoholMode === "alcoholic" ? "Com álcool" : "Sem álcool", ...custom.bases, ...custom.fruits, ...custom.extras, sweetness === "sweetened" ? "Adoçado" : "Sem açúcar"].join(" + "), priceCents: customTotal, quantity: 1, category: "Destaques", gradient: "from-[#8d1022] to-[#f07a28]", icon: alcoholMode === "alcoholic" ? "martini" : "water", custom };
    setCart((current) => [...current, item]);
    setAlcoholMode(null); setSelectedBases([]); setSelectedFruits([]); setSelectedExtras([]); setSweetness(null); setDrinkName(""); setCartOpen(true);
    toast.success("Seu drink personalizado foi adicionado");
  };

  const filteredProducts = products.filter((product) => (category === "Todos" || product.category === category) && `${product.name} ${product.description}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const zone = deliveryMode === "delivery" ? findZone(config.zones, address.neighborhood) : null;
  const deliveryFeeCents = deliveryMode === "delivery" ? (zone?.feeCents ?? 0) : 0;
  const paymentFeeCents = payment === "pix" ? 0 : config.cardFeeCents;
  const totalCents = subtotalCents + deliveryFeeCents + paymentFeeCents;
  const updateQuantity = (id: string, delta: number) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));

  const lookupCep = async (rawCep: string) => {
    const cep = rawCep.replace(/\D/g, "").slice(0, 8);
    setAddress((current) => ({ ...current, cep: formatCep(cep) }));
    if (cep.length !== 8) { setAddressState("idle"); return; }
    setAddressState("loading");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string };
      if (!response.ok || data.erro) throw new Error("CEP não encontrado");
      const next = { cep: formatCep(cep), street: data.logradouro ?? "", number: address.number, complement: address.complement, neighborhood: data.bairro ?? "", city: data.localidade ?? "" };
      setAddress(next);
      setAddressState(data.localidade === "Campo Grande" && findZone(config.zones, data.bairro ?? "") ? "served" : "unserved");
    } catch { setAddressState("error"); }
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ageConfirmed) { toast.error("Confirme que você tem 18 anos ou mais."); return; }
    if (deliveryMode === "delivery" && addressState !== "served") { toast.error("Informe um CEP dentro da área de entrega."); return; }
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: form.get("name"), customerPhone: form.get("phone"), fulfillmentType: deliveryMode, cep: address.cep, street: address.street, streetNumber: address.number, complement: address.complement, neighborhood: address.neighborhood, city: address.city, notes: form.get("notes"), paymentMethod: payment, ageConfirmed, items: cart.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, custom: item.custom })) }) });
      const data = await response.json() as { error?: string; order?: OrderResult };
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar o pedido.");
      if (!data.order) throw new Error("O servidor não retornou o pedido criado.");
      setOrderDone(data.order); setCart([]); setAgeConfirmed(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar o pedido."); }
    finally { setSubmitting(false); }
  };

  const whatsappMessage = orderDone ? buildWhatsappMessage(orderDone) : "";

  return (
    <div className="min-h-screen bg-[#f7f5f1] text-[#211a18]">
      <Toaster richColors position="bottom-right" />
      <div className="bg-[#8f1823] px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-white uppercase">Venda proibida para menores de 18 anos</div>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#161312]/95 text-white shadow-lg backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#inicio" className="rounded-lg bg-white px-3 py-2" aria-label="Mixology Drinkeria — início"><img src="/images/logo-colorida.png" alt="Mixology Drinkeria" className="h-7 w-auto sm:h-8" /></a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-white/75 md:flex" aria-label="Navegação principal"><a className="hover:text-white" href="#cardapio">Cardápio</a><a className="hover:text-white" href="#monte-seu-drink">Monte o seu</a><a className="hover:text-white" href="#entrega">Entrega</a></nav>
          <div className="flex items-center gap-2"><span className="hidden rounded-full bg-white/7 px-3 py-2 text-xs text-white/75 sm:inline">Qua–dom · 19h–00h</span><Button type="button" onClick={() => setCartOpen(true)} className="relative h-11 rounded-full bg-[#c52a30] px-4 text-white hover:bg-[#df3d3e]" aria-label={`Abrir carrinho com ${itemCount} itens`}><ShoppingBag className="h-4 w-4" /><span className="hidden sm:inline">Carrinho</span>{hydrated && itemCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-[#9c1e27]">{itemCount}</span>}</Button></div>
        </div>
      </header>

      <main>
        <section id="inicio" className="bg-[#161312] text-white"><div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-12"><div className="relative z-10 py-5"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-semibold tracking-[0.1em] text-[#ffad4a] uppercase"><Sparkles className="h-4 w-4" /> Feito do seu jeito</div><h1 className="max-w-xl font-display text-5xl leading-[0.98] font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">Seu drink.<br />Sua mistura.</h1><p className="mt-5 max-w-lg text-base leading-7 text-white/65 sm:text-lg">Escolha um clássico ou monte uma combinação só sua. Você vê o preço completo antes de pedir.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button asChild className="h-12 rounded-full bg-[#c52a30] px-6 text-base"><a href="#cardapio">Ver cardápio <ArrowRight /></a></Button><Button asChild variant="outline" className="h-12 rounded-full border-white/15 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white"><a href="#monte-seu-drink">Montar meu drink</a></Button></div><dl className="mt-8 grid max-w-lg grid-cols-2 gap-3 text-sm sm:grid-cols-3"><Info label="Entrega" value="Por bairro" /><Info label="Previsão" value={`${config.etaMin}–${config.etaMax} min`} /><Info label="Pagamento" value="Pix ou cartão" /></dl></div><div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#281b17] shadow-2xl shadow-black/35"><img src="/images/hero-drinks.png" alt="Drinks da Mixology" className="aspect-[16/11] w-full object-cover lg:aspect-[1.18/1]" /><div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 pt-20"><div><p className="text-xs font-semibold tracking-[0.12em] text-[#ffb14d] uppercase">Sugestão da casa</p><p className="mt-1 text-xl font-semibold">Ruby Tonic</p></div><button type="button" onClick={() => addProduct(products[0], true)} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#8f1823]">+ Adicionar</button></div></div></div></section>

        <section id="cardapio" className="scroll-mt-24 py-16 sm:py-20"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow">Cardápio</p><h2 className="section-title">Escolha seu próximo favorito</h2><p className="mt-2 text-[#756964]">Ingredientes à vista e pedido sem complicação.</p></div><label className="flex h-12 w-full items-center gap-3 rounded-full border border-[#ded7d1] bg-white px-4 shadow-sm md:w-72"><Search className="h-4 w-4 text-[#897b75]" /><span className="sr-only">Buscar no cardápio</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar um drink" className="min-w-0 flex-1 bg-transparent text-base outline-none" /></label></div><div className="scrollbar-none mt-7 flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold ${category === item ? "border-[#251b18] bg-[#251b18] text-white" : "border-[#ded7d1] bg-white text-[#6f625d]"}`}>{item}</button>)}</div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => addProduct(product)} />)}</div></div></section>

        <section id="monte-seu-drink" className="scroll-mt-20 bg-[#211a18] py-16 text-white sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="eyebrow text-[#ff9d3d]">Experiência Mixology</p>
                <h2 className="font-display text-4xl leading-tight font-semibold tracking-[-0.04em] sm:text-5xl">Monte do seu jeito.</h2>
                <p className="mt-4 max-w-md leading-7 text-white/60">Escolha até duas bebidas-base, combine os complementos que quiser e decida se prefere adoçado ou sem açúcar.</p>
                <div className="mt-7 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between"><span className="text-sm text-white/55">Sua combinação</span><span className="text-2xl font-extrabold text-[#ff9d3d]">{formatMoneyFromCents(customTotal)}</span></div>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-white/75">
                    {alcoholMode ? (alcoholMode === "alcoholic" ? "Com álcool" : "Sem álcool") : "Escolha o tipo"}
                    {selectedBases.length ? ` + ${selectedBases.map((item) => item.name).join(" + ")}` : ""}
                    {selectedFruits.length ? ` + ${selectedFruits.map((item) => item.name).join(" + ")}` : ""}
                    {selectedExtras.length ? ` + ${selectedExtras.map((item) => item.name).join(" + ")}` : ""}
                    {sweetness ? ` + ${sweetness === "sweetened" ? "Adoçado" : "Sem açúcar"}` : ""}
                  </p>
                  <Input value={drinkName} onChange={(event) => setDrinkName(event.target.value)} maxLength={32} placeholder="Dê um nome ao seu drink (opcional)" className="mt-4 h-12 border-white/12 bg-white/8 text-white placeholder:text-white/35" />
                  <Button type="button" disabled={!customReady} onClick={addCustomDrink} className="mt-3 h-12 w-full rounded-xl bg-[#c52a30] disabled:bg-white/10">{customReady ? "Adicionar ao carrinho" : "Complete as cinco etapas"}</Button>
                </div>
              </div>
              <div className="space-y-5">
                <BuilderStep number="1" title="Com álcool ou sem álcool?">
                  <div className="grid grid-cols-2 gap-3">
                    <ChoiceButton selected={alcoholMode === "alcoholic"} onClick={() => { setAlcoholMode("alcoholic"); setSelectedBases([]); }} label="Com álcool" priceLabel="18+" />
                    <ChoiceButton selected={alcoholMode === "non_alcoholic"} onClick={() => { setAlcoholMode("non_alcoholic"); setSelectedBases([]); }} label="Sem álcool" priceLabel="0%" />
                  </div>
                </BuilderStep>
                <BuilderStep number="2" title="Escolha até 2 bebidas-base" detail={alcoholMode ? `${selectedBases.length}/2 selecionadas` : "Escolha o tipo primeiro"}>
                  <div className="choice-grid">{activeBases.map((item) => { const selected = selectedBases.some((base) => base.name === item.name); return <ChoiceButton key={item.name} selected={selected} disabled={!alcoholMode || (!selected && selectedBases.length >= 2)} onClick={() => setSelectedBases((current) => selected ? current.filter((base) => base.name !== item.name) : [...current, item])} label={item.name} priceLabel={`+ ${formatMoneyFromCents(item.priceCents)}`} />; })}</div>
                </BuilderStep>
                <BuilderStep number="3" title="Escolha até 3 frutas" detail={`${selectedFruits.length}/3 selecionadas`}>
                  <div className="choice-grid">{fruits.map((item) => { const selected = selectedFruits.some((fruit) => fruit.name === item.name); return <ChoiceButton key={item.name} selected={selected} disabled={!selectedBases.length || (!selected && selectedFruits.length >= 3)} onClick={() => setSelectedFruits((current) => selected ? current.filter((fruit) => fruit.name !== item.name) : [...current, item])} label={item.name} priceLabel={`+ ${formatMoneyFromCents(item.priceCents)}`} />; })}</div>
                </BuilderStep>
                <BuilderStep number="4" title="Escolha os complementos" detail={selectedExtras.length ? `${selectedExtras.length} selecionado${selectedExtras.length > 1 ? "s" : ""}` : "Selecione pelo menos um"}>
                  <div className="choice-grid">{extras.map((item) => { const selected = selectedExtras.some((extra) => extra.name === item.name); return <ChoiceButton key={item.name} selected={selected} disabled={!selectedBases.length} onClick={() => setSelectedExtras((current) => selected ? current.filter((extra) => extra.name !== item.name) : [...current, item])} label={item.name} priceLabel={item.priceCents ? `+ ${formatMoneyFromCents(item.priceCents)}` : "grátis"} />; })}</div>
                </BuilderStep>
                <BuilderStep number="5" title="Como você prefere?">
                  <div className="grid grid-cols-2 gap-3">
                    <ChoiceButton selected={sweetness === "sweetened"} disabled={!selectedExtras.length} onClick={() => setSweetness("sweetened")} label="Adoçado" priceLabel="com açúcar" />
                    <ChoiceButton selected={sweetness === "unsweetened"} disabled={!selectedExtras.length} onClick={() => setSweetness("unsweetened")} label="Sem açúcar" priceLabel="não adoçar" />
                  </div>
                </BuilderStep>
              </div>
            </div>
          </div>
        </section>

        <section id="entrega" className="scroll-mt-24 py-16 sm:py-20"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="rounded-[2rem] bg-[#fffdf9] p-6 shadow-xl sm:p-10"><div><p className="eyebrow">Pedido sem surpresa</p><h2 className="section-title">Da escolha até sua porta</h2></div><div className="mt-8 grid gap-4 md:grid-cols-3">{[{ icon: Menu, title: "Escolha", text: "Pegue um favorito ou monte uma combinação com uma base obrigatória." }, { icon: MapPin, title: "Confira", text: "Informe o CEP e veja entrega, taxa do cartão e total antes de enviar." }, { icon: Truck, title: "Receba", text: `Entrega estimada em ${config.etaMin}–${config.etaMax} minutos após a confirmação.` }].map((item) => <article key={item.title} className="rounded-2xl border border-[#e8e0db] bg-white p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#9f2029] text-white"><item.icon /></span><h3 className="mt-5 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#776b66]">{item.text}</p></article>)}</div></div></div></section>
      </main>

      <footer className="bg-[#161312] text-white"><div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]"><div><div className="inline-flex rounded-lg bg-white px-3 py-2"><img src="/images/logo-colorida.png" alt="Mixology Drinkeria" className="h-7 w-auto" /></div><p className="mt-4 max-w-sm text-sm leading-6 text-white/55">Drinks clássicos e combinações personalizadas para entrega ou retirada.</p></div><div><p className="text-sm font-bold">Atendimento</p><ul className="mt-3 space-y-2 text-sm text-white/55"><li>{config.openingLabel}</li><li>{config.storeAddress}</li><li>Previsão: {config.etaMin}–{config.etaMax} minutos</li></ul></div><div><p className="text-sm font-bold">Privacidade e equipe</p><div className="mt-3 flex flex-col items-start gap-2 text-sm text-white/55"><button onClick={() => setCookiePreferencesOpen(true)} className="hover:text-white">Preferências de cookies</button><a href="/admin" className="hover:text-white">Acesso de funcionários</a></div></div></div><div className="border-t border-white/8 px-4 py-5 text-center text-xs text-white/40">© 2026 Mixology Drinkeria · Beba com moderação</div></footer>

      <CartSheet open={cartOpen} setOpen={setCartOpen} cart={cart} itemCount={itemCount} updateQuantity={updateQuantity} deliveryMode={deliveryMode} setDeliveryMode={setDeliveryMode} subtotalCents={subtotalCents} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); setOrderDone(null); }} />
      <CheckoutDialog open={checkoutOpen} setOpen={setCheckoutOpen} orderDone={orderDone} whatsappMessage={whatsappMessage} config={config} cart={cart} deliveryMode={deliveryMode} payment={payment} setPayment={setPayment} address={address} setAddress={setAddress} addressState={addressState} lookupCep={lookupCep} deliveryFeeCents={deliveryFeeCents} paymentFeeCents={paymentFeeCents} subtotalCents={subtotalCents} totalCents={totalCents} ageConfirmed={ageConfirmed} setAgeConfirmed={setAgeConfirmed} submitting={submitting} submitOrder={submitOrder} />
      <ChatWidget whatsappDigits={config.whatsappDigits} />
      <CookieConsent onConfigure={() => setCookiePreferencesOpen(true)} />
      <CookiePreferences open={cookiePreferencesOpen} setOpen={setCookiePreferencesOpen} />
    </div>
  );
}

function CheckoutDialog(props: { open: boolean; setOpen: (open: boolean) => void; orderDone: OrderResult | null; whatsappMessage: string; config: PublicConfig; cart: CartItem[]; deliveryMode: "delivery" | "pickup"; payment: "pix" | "credit" | "debit"; setPayment: (value: "pix" | "credit" | "debit") => void; address: { cep: string; street: string; number: string; complement: string; neighborhood: string; city: string }; setAddress: React.Dispatch<React.SetStateAction<{ cep: string; street: string; number: string; complement: string; neighborhood: string; city: string }>>; addressState: string; lookupCep: (cep: string) => Promise<void>; deliveryFeeCents: number; paymentFeeCents: number; subtotalCents: number; totalCents: number; ageConfirmed: boolean; setAgeConfirmed: (value: boolean) => void; submitting: boolean; submitOrder: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const { open, setOpen, orderDone, whatsappMessage, config, cart, deliveryMode, payment, setPayment, address, setAddress, addressState, lookupCep, deliveryFeeCents, paymentFeeCents, subtotalCents, totalCents, ageConfirmed, setAgeConfirmed, submitting, submitOrder } = props;
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[94vh] overflow-y-auto rounded-3xl border-[#e3dad5] bg-[#fbf9f6] p-0 sm:max-w-3xl">{orderDone ? <div className="p-8 text-center sm:p-12"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f2e8] text-[#34753d]"><Check className="h-8 w-8" /></span><DialogHeader className="mt-5 text-center sm:text-center"><DialogTitle className="text-2xl">Pedido {orderDone.orderNumber} recebido!</DialogTitle><DialogDescription className="mx-auto max-w-md leading-6">Previsão de {orderDone.etaMin}–{orderDone.etaMax} minutos após a confirmação da Mixology.</DialogDescription></DialogHeader><div className="mx-auto mt-6 max-w-md rounded-2xl bg-white p-4 text-left shadow-sm"><p className="font-bold">{orderDone.customerName}</p><p className="mt-1 text-sm text-[#776b66]">Total: {formatMoneyFromCents(orderDone.totalCents)} · {paymentLabel(orderDone.paymentMethod)}</p></div><Button asChild className="mt-5 h-12 rounded-full bg-[#1fa855] px-6 text-white hover:bg-[#188b47]"><a href={`https://wa.me/${config.whatsappDigits}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer"><MessageCircle /> Confirmar também pelo WhatsApp</a></Button><p className="mt-3 text-xs text-[#81736d]">A mensagem será preenchida; você escolhe quando enviar.</p><Button type="button" variant="ghost" onClick={() => setOpen(false)} className="mt-3">Voltar ao cardápio</Button></div> : <form onSubmit={submitOrder}><div className="border-b border-[#e5ddd8] p-6"><DialogHeader><DialogTitle className="text-2xl">Finalizar pedido</DialogTitle><DialogDescription>Confira endereço, taxas e total antes de enviar.</DialogDescription></DialogHeader></div><div className="grid gap-6 p-6 sm:grid-cols-[1fr_0.8fr]"><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Seu nome" htmlFor="name"><Input id="name" name="name" autoComplete="name" required /></Field><Field label="WhatsApp" htmlFor="phone"><Input id="phone" name="phone" type="tel" placeholder="(67) 99999-9999" required /></Field></div>{deliveryMode === "delivery" && <><div className="grid gap-4 sm:grid-cols-[.65fr_1.35fr]"><Field label="CEP" htmlFor="cep"><Input id="cep" value={address.cep} onChange={(event) => void lookupCep(event.target.value)} inputMode="numeric" placeholder="00000-000" required /></Field><Field label="Rua" htmlFor="street"><Input id="street" value={address.street} onChange={(event) => setAddress((current) => ({ ...current, street: event.target.value }))} required /></Field></div><div className="grid grid-cols-[.55fr_1.45fr] gap-4"><Field label="Número" htmlFor="number"><Input id="number" value={address.number} onChange={(event) => setAddress((current) => ({ ...current, number: event.target.value }))} required /></Field><Field label="Complemento" htmlFor="complement"><Input id="complement" value={address.complement} onChange={(event) => setAddress((current) => ({ ...current, complement: event.target.value }))} /></Field></div>{addressState === "loading" && <p className="text-sm text-[#81736d]">Consultando CEP…</p>}{addressState === "served" && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="mr-1 inline h-4 w-4" /> {address.neighborhood}: entrega {formatMoneyFromCents(deliveryFeeCents)}</p>}{addressState === "unserved" && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ainda não entregamos automaticamente em {address.neighborhood || "este endereço"}. <a className="font-bold underline" href={`https://wa.me/${config.whatsappDigits}?text=${encodeURIComponent("Olá, Mixology! Gostaria de consultar entrega para o CEP " + address.cep)}`} target="_blank" rel="noreferrer">Consultar no WhatsApp</a></div>}{addressState === "error" && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Não encontramos esse CEP. Revise e tente novamente.</p>}</>}<Field label="Observações" htmlFor="notes"><Textarea id="notes" name="notes" placeholder="Ex.: retirar açúcar, tocar o interfone���" /></Field><fieldset><legend className="mb-3 text-sm font-bold">Pagamento</legend><RadioGroup value={payment} onValueChange={(value) => setPayment(value as typeof payment)} className="grid gap-2 sm:grid-cols-3">{[{ value: "pix", label: "Pix" }, { value: "credit", label: "Crédito" }, { value: "debit", label: "Débito" }].map((option) => <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${payment === option.value ? "border-[#a1222b] bg-[#f8ecec]" : "bg-white"}`}><RadioGroupItem value={option.value} /> {option.label}</label>)}</RadioGroup><p className="mt-2 text-xs text-[#83756f]">Cartão pago na entrega ou retirada. Crédito e débito têm taxa fixa de {formatMoneyFromCents(config.cardFeeCents)}.</p></fieldset></div><aside className="h-fit rounded-2xl bg-[#211a18] p-5 text-white sm:sticky sm:top-0"><p className="font-bold">Resumo</p><div className="mt-4 space-y-3 border-b border-white/10 pb-4">{cart.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-white/60">{item.quantity}× {item.name}</span><span>{formatMoneyFromCents(item.priceCents * item.quantity)}</span></div>)}</div><SummaryRow label="Subtotal" value={subtotalCents} /><SummaryRow label={deliveryMode === "delivery" ? "Entrega" : "Retirada"} value={deliveryFeeCents} free={deliveryMode === "pickup"} /><SummaryRow label="Taxa de pagamento" value={paymentFeeCents} free={payment === "pix"} /><div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4"><span className="font-semibold">Total</span><span className="text-2xl font-extrabold text-[#ff9d3d]">{formatMoneyFromCents(totalCents)}</span></div><label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/12 bg-white/5 p-3"><Checkbox checked={ageConfirmed} onCheckedChange={(checked) => setAgeConfirmed(checked === true)} className="mt-0.5 border-white/60 data-[state=checked]:bg-[#c52a30]" /><span className="text-xs leading-5 text-white/75">Declaro que tenho 18 anos ou mais e estou ciente de que poderá ser solicitado documento com foto na entrega ou retirada.</span></label><Button type="submit" disabled={!ageConfirmed || submitting || (deliveryMode === "delivery" && addressState !== "served")} className="mt-4 h-12 w-full rounded-full bg-[#c52a30] disabled:bg-white/10">{submitting ? "Enviando…" : "Confirmar pedido"} <ArrowRight /></Button></aside></div></form>}</DialogContent></Dialog>;
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) { const Icon = product.icon === "martini" ? Martini : product.icon === "wine" ? Wine : GlassWater; return <article className="group overflow-hidden rounded-[1.5rem] border border-[#e1dad5] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${product.gradient}`}><Icon className="h-14 w-14 stroke-[1.35] text-white/90" />{product.badge && <span className="absolute top-3 left-3 rounded-full bg-white/92 px-3 py-1 text-xs font-bold text-[#7d1b24]">{product.badge}</span>}</div><div className="p-5"><h3 className="text-lg font-bold">{product.name}</h3><p className="mt-1 min-h-12 text-sm leading-6 text-[#776b66]">{product.description}</p><div className="mt-4 flex items-center justify-between border-t pt-4"><p className="text-lg font-extrabold text-[#9f2029]">{formatMoneyFromCents(product.priceCents)}</p><Button type="button" onClick={onAdd} className="rounded-full bg-[#9f2029]"><Plus /> Adicionar</Button></div></div></article>; }
function BuilderStep({ number, title, detail, children }: { number: string; title: string; detail?: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c52a30] text-sm font-bold">{number}</span><h3 className="text-lg font-bold">{title}</h3></div>{detail && <span className="text-xs font-semibold text-[#ff9d3d]">{detail}</span>}</div>{children}</section>; }
function ChoiceButton({ selected, disabled, onClick, label, priceLabel }: { selected: boolean; disabled?: boolean; onClick: () => void; label: string; priceLabel: string }) { return <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${selected ? "border-[#ff8143] bg-[#ff8143]/12 text-white" : "border-white/10 bg-white/5 text-white/72 hover:border-white/25"} disabled:cursor-not-allowed disabled:opacity-30`}><span className="flex items-center gap-2 font-semibold">{selected && <Check className="h-4 w-4 text-[#ff9d3d]" />}{label}</span><span className="text-xs text-white/45">{priceLabel}</span></button>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><dt className="text-white/45">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <label htmlFor={htmlFor} className="grid gap-2 text-sm font-bold">{label}{children}</label>; }
function SummaryRow({ label, value, free }: { label: string; value: number; free?: boolean }) { return <div className="mt-3 flex justify-between text-sm text-white/60"><span>{label}</span><span>{free ? "Sem taxa" : formatMoneyFromCents(value)}</span></div>; }

function CartSheet({ open, setOpen, cart, itemCount, updateQuantity, deliveryMode, setDeliveryMode, subtotalCents, onCheckout }: { open: boolean; setOpen: (open: boolean) => void; cart: CartItem[]; itemCount: number; updateQuantity: (id: string, delta: number) => void; deliveryMode: "delivery" | "pickup"; setDeliveryMode: (mode: "delivery" | "pickup") => void; subtotalCents: number; onCheckout: () => void }) { return <Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full border-l-[#e5ddd8] bg-[#fbf9f6] sm:max-w-md"><SheetHeader className="border-b p-6"><SheetTitle>Seu carrinho</SheetTitle><SheetDescription>{itemCount ? `${itemCount} ${itemCount === 1 ? "item" : "itens"} no pedido` : "Escolha um drink para começar"}</SheetDescription></SheetHeader><div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">{cart.length ? cart.map((item) => <article key={item.id} className="rounded-2xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-xs leading-5 text-[#7b6e68]">{item.details || item.description}</p><p className="mt-2 font-extrabold text-[#9f2029]">{formatMoneyFromCents(item.priceCents)}</p></div><div className="flex items-center rounded-full border p-1"><button type="button" onClick={() => updateQuantity(item.id, -1)} className="grid h-8 w-8 place-items-center"><Minus className="h-4 w-4" /></button><span className="w-7 text-center text-sm font-bold">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, 1)} className="grid h-8 w-8 place-items-center"><Plus className="h-4 w-4" /></button></div></div></article>) : <div className="grid min-h-72 place-items-center text-center text-[#7b6e68]"><div><ShoppingBag className="mx-auto h-10 w-10" /><p className="mt-3 font-bold">Seu carrinho está vazio</p></div></div>}{cart.length > 0 && <><div className="pt-3"><p className="mb-3 text-sm font-bold">Como você quer receber?</p><RadioGroup value={deliveryMode} onValueChange={(value) => setDeliveryMode(value as typeof deliveryMode)} className="grid grid-cols-2 gap-2"><label className={`cursor-pointer rounded-2xl border p-3 ${deliveryMode === "delivery" ? "border-[#a1222b] bg-[#f8ecec]" : "bg-white"}`}><RadioGroupItem value="delivery" /> <span className="ml-2 text-sm font-bold">Entrega</span></label><label className={`cursor-pointer rounded-2xl border p-3 ${deliveryMode === "pickup" ? "border-[#a1222b] bg-[#f8ecec]" : "bg-white"}`}><RadioGroupItem value="pickup" /> <span className="ml-2 text-sm font-bold">Retirada</span></label></RadioGroup></div><div className="rounded-2xl bg-[#211a18] p-4 text-white"><div className="flex justify-between text-sm text-white/60"><span>Subtotal</span><span>{formatMoneyFromCents(subtotalCents)}</span></div><p className="mt-2 text-xs text-white/45">A entrega será calculada pelo CEP no checkout.</p></div></>}</div>{cart.length > 0 && <SheetFooter className="border-t bg-white p-6"><Button type="button" onClick={onCheckout} className="h-12 rounded-full bg-[#a1222b]">Finalizar sem criar conta <ArrowRight /></Button></SheetFooter>}</SheetContent></Sheet>; }

function ChatWidget({ whatsappDigits }: { whatsappDigits: string }) {
  const [open, setOpen] = useState(false); const [token, setToken] = useState(""); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [message, setMessage] = useState(""); const [messages, setMessages] = useState<ChatMessage[]>([]); const [sending, setSending] = useState(false);
  useEffect(() => { setToken(window.localStorage.getItem("mixology-chat-token") ?? ""); }, []);
  useEffect(() => { if (!token || !open) return; const load = () => fetch(`/api/chat?token=${encodeURIComponent(token)}`, { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ messages?: ChatMessage[] }> : null).then((data) => data && setMessages(data.messages ?? [])).catch(() => undefined); void load(); const interval = window.setInterval(load, 4000); return () => window.clearInterval(interval); }, [token, open]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!message.trim()) return; setSending(true); const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { action: "message", token, message } : { action: "start", name, phone, message }) }); const data = await response.json() as { error?: string; conversation?: { token?: string } }; setSending(false); if (!response.ok) { toast.error(data.error || "Não foi possível enviar."); return; } if (data.conversation?.token) { setToken(data.conversation.token); window.localStorage.setItem("mixology-chat-token", data.conversation.token); } setMessages((current) => [...current, { id: Date.now(), senderType: "customer", senderName: name || "Você", body: message, createdAt: Date.now() }]); setMessage(""); };
  return <><button type="button" onClick={() => setOpen(true)} className="fixed right-4 bottom-5 z-40 flex h-14 items-center gap-2 rounded-full bg-[#a1222b] px-5 font-bold text-white shadow-2xl" aria-label="Abrir atendimento"><MessageCircle /> <span className="hidden sm:inline">Precisa de ajuda?</span></button>{open && <section className="fixed right-3 bottom-3 z-50 flex h-[min(620px,calc(100vh-24px))] w-[calc(100vw-24px)] max-w-sm flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl"><header className="flex items-center justify-between bg-[#211a18] p-4 text-white"><div><p className="font-bold">Atendimento Mixology</p><p className="text-xs text-white/55">Respondemos durante o funcionamento</p></div><button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><X /></button></header><div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f4f1] p-4">{!token && <div className="rounded-2xl bg-white p-4 text-sm leading-6 text-[#70645f]">Olá! Informe seu nome e WhatsApp para iniciar. Se você sair do site, conseguimos continuar o atendimento pelo número informado.</div>}{messages.map((item) => <div key={item.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${item.senderType === "staff" ? "bg-white shadow-sm" : "ml-auto bg-[#a1222b] text-white"}`}><p className="text-xs font-bold opacity-60">{item.senderName}</p><p className="mt-1 whitespace-pre-wrap">{item.body}</p></div>)}</div><form onSubmit={submit} className="space-y-2 border-t p-4">{!token && <div className="grid grid-cols-2 gap-2"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" required /><Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="WhatsApp" required /></div>}<div className="flex gap-2"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Como podemos ajudar?" className="min-h-11 resize-none" required /><Button type="submit" size="icon" disabled={sending} className="h-11 w-11 shrink-0 bg-[#a1222b]"><Send /></Button></div><a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer" className="block text-center text-xs font-semibold text-[#20834a]">Prefiro conversar pelo WhatsApp</a></form></section>}</>;
}

function CookieConsent({ onConfigure }: { onConfigure: () => void }) { const [visible, setVisible] = useState(false); useEffect(() => { setVisible(!window.localStorage.getItem("mixology-cookie-consent")); }, []); const save = (mode: "all" | "essential") => { window.localStorage.setItem("mixology-cookie-consent", JSON.stringify({ necessary: true, analytics: mode === "all", marketing: mode === "all", savedAt: Date.now() })); setVisible(false); }; if (!visible) return null; return <section className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-4xl rounded-2xl border bg-white p-5 shadow-2xl"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="flex flex-1 gap-3"><Cookie className="mt-0.5 h-6 w-6 shrink-0 text-[#a1222b]" /><div><p className="font-bold">Sua privacidade importa</p><p className="mt-1 text-sm leading-6 text-[#70645f]">Usamos armazenamento necessário para carrinho, atendimento e segurança. Estatísticas e marketing são opcionais.</p></div></div><div className="grid gap-2 sm:grid-cols-3"><Button type="button" variant="outline" onClick={() => save("essential")}>Recusar opcionais</Button><Button type="button" variant="outline" onClick={onConfigure}>Configurar</Button><Button type="button" onClick={() => save("all")} className="bg-[#a1222b]">Aceitar todos</Button></div></div></section>; }
function CookiePreferences({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) { const [analytics, setAnalytics] = useState(false); const [marketing, setMarketing] = useState(false); useEffect(() => { if (!open) return; try { const saved = JSON.parse(window.localStorage.getItem("mixology-cookie-consent") || "{}"); setAnalytics(Boolean(saved.analytics)); setMarketing(Boolean(saved.marketing)); } catch { /* mantém desativado */ } }, [open]); const save = () => { window.localStorage.setItem("mixology-cookie-consent", JSON.stringify({ necessary: true, analytics, marketing, savedAt: Date.now() })); setOpen(false); toast.success("Preferências salvas"); }; return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="rounded-3xl"><DialogHeader><DialogTitle>Preferências de cookies</DialogTitle><DialogDescription>Você pode mudar sua escolha quando quiser.</DialogDescription></DialogHeader><div className="space-y-3"><CookieRow title="Necessários" text="Carrinho, segurança, sessão administrativa e continuidade do chat." checked disabled /><CookieRow title="Estatísticas" text="Ajuda a entender quais páginas e produtos são mais acessados." checked={analytics} setChecked={setAnalytics} /><CookieRow title="Marketing" text="Permite medir campanhas quando ferramentas de anúncios forem ativadas." checked={marketing} setChecked={setMarketing} /></div><Button type="button" onClick={save} className="bg-[#a1222b]">Salvar preferências</Button></DialogContent></Dialog>; }
function CookieRow({ title, text, checked, disabled, setChecked }: { title: string; text: string; checked: boolean; disabled?: boolean; setChecked?: (value: boolean) => void }) { return <label className="flex items-start justify-between gap-4 rounded-2xl border p-4"><span><strong>{title}</strong><p className="mt-1 text-sm leading-5 text-[#70645f]">{text}</p></span><Switch checked={checked} disabled={disabled} onCheckedChange={setChecked} /></label>; }

function buildWhatsappMessage(order: OrderResult) { return [`Olá, Mixology! Sou ${order.customerName} e fiz o pedido ${order.orderNumber}.`, "", "Itens:", ...order.items.map((item) => `${item.quantity}× ${item.name} — ${formatMoneyFromCents(item.unitPriceCents * item.quantity)}${item.details ? `\n${item.details}` : ""}`), "", `Subtotal: ${formatMoneyFromCents(order.subtotalCents)}`, `Entrega: ${formatMoneyFromCents(order.deliveryFeeCents)}`, `Taxa de pagamento: ${formatMoneyFromCents(order.paymentFeeCents)}`, `Total: ${formatMoneyFromCents(order.totalCents)}`, `Pagamento: ${paymentLabel(order.paymentMethod)}`, `Previsão: ${order.etaMin}–${order.etaMax} minutos`, "", "Gostaria de confirmar meu pedido pelo WhatsApp."].join("\n"); }
function paymentLabel(value: string) { return value === "pix" ? "Pix" : value === "credit" ? "Crédito na entrega" : "Débito na entrega"; }
function formatCep(value: string) { return value.length > 5 ? `${value.slice(0, 5)}-${value.slice(5)}` : value; }
