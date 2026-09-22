"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, CheckCircle2, ChevronRight, Clock3, LogOut, MessageCircle, PackageCheck, RefreshCw, Send, Settings2, ShieldCheck, ShoppingBag, Truck, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { formatMoneyFromCents } from "@/lib/catalog";

type Viewer = { name: string; email: string; role: "admin" | "service" | "production" };
type Order = { id: string; orderNumber: string; customerName: string; customerPhone: string; fulfillmentType: string; neighborhood?: string; street?: string; streetNumber?: string; items: Array<{ name: string; quantity: number; unitPriceCents: number; details?: string }>; subtotalCents: number; deliveryFeeCents: number; paymentMethod: string; paymentFeeCents: number; totalCents: number; notes?: string; ageConfirmed: boolean; status: string; etaMin: number; etaMax: number; createdAt: number };
type Conversation = { id: string; customerName: string; customerPhone: string; status: string; assignedTo?: string; lastMessageAt: number; lastMessage?: string; lastSenderType?: string };
type Message = { id: number; senderType: string; senderName: string; body: string; createdAt: number };
type Zone = { neighborhood: string; feeCents: number; active: boolean };
type Staff = { id: number; email: string; name: string; role: Viewer["role"]; active: number | boolean };

const statusLabels: Record<string, string> = { new: "Novo", confirmed: "Confirmado", preparing: "Em preparo", ready: "Pronto para retirada", out_for_delivery: "Saiu para entrega", completed: "Concluído", cancelled: "Cancelado" };
const statusClasses: Record<string, string> = { new: "bg-amber-100 text-amber-900", confirmed: "bg-sky-100 text-sky-900", preparing: "bg-orange-100 text-orange-900", ready: "bg-violet-100 text-violet-900", out_for_delivery: "bg-indigo-100 text-indigo-900", completed: "bg-emerald-100 text-emerald-900", cancelled: "bg-rose-100 text-rose-900" };
const roleLabels: Record<string, string> = { admin: "Administrador", service: "Atendimento", production: "Produção" };

export function AdminDashboard({ viewer, signOutHref }: { viewer: Viewer; signOutHref: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const notificationsReadyRef = useRef(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const chatActivityRef = useRef<Map<string, number>>(new Map());

  const playAlert = useCallback((kind: "order" | "chat" | "enabled") => {
    const context = audioContextRef.current;
    if (!soundEnabledRef.current || !context || context.state !== "running") return;

    const patterns = {
      order: [
        { frequency: 659, offset: 0, duration: 0.18, gain: 0.18 },
        { frequency: 880, offset: 0.13, duration: 0.2, gain: 0.2 },
        { frequency: 1175, offset: 0.28, duration: 0.32, gain: 0.22 },
      ],
      chat: [
        { frequency: 740, offset: 0, duration: 0.13, gain: 0.13 },
        { frequency: 554, offset: 0.16, duration: 0.2, gain: 0.11 },
      ],
      enabled: [
        { frequency: 784, offset: 0, duration: 0.12, gain: 0.1 },
        { frequency: 988, offset: 0.11, duration: 0.18, gain: 0.1 },
      ],
    } as const;

    for (const note of patterns[kind]) {
      const start = context.currentTime + note.offset;
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = kind === "chat" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(note.frequency, start);
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(note.gain, start + 0.012);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.03);
    }
  }, []);

  const inspectIncoming = useCallback((nextOrders: Order[], nextConversations: Conversation[]) => {
    if (!notificationsReadyRef.current) {
      knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
      chatActivityRef.current = new Map(nextConversations.map((chat) => [chat.id, chat.lastMessageAt]));
      notificationsReadyRef.current = true;
      return;
    }

    const hasNewOrder = nextOrders.some((order) => !knownOrderIdsRef.current.has(order.id));
    const hasNewCustomerMessage = nextConversations.some((chat) => {
      if (chat.lastSenderType !== "customer") return false;
      const previousActivity = chatActivityRef.current.get(chat.id);
      return previousActivity === undefined || chat.lastMessageAt > previousActivity;
    });

    knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
    chatActivityRef.current = new Map(nextConversations.map((chat) => [chat.id, chat.lastMessageAt]));

    if (hasNewOrder) playAlert("order");
    if (hasNewCustomerMessage) {
      window.setTimeout(() => playAlert("chat"), hasNewOrder ? 750 : 0);
    }
  }, [playAlert]);

  const toggleSounds = useCallback(async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context) await context.close().catch(() => undefined);
      toast.message("Alertas sonoros desativados");
      return;
    }

    try {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await context.resume();
      soundEnabledRef.current = true;
      setSoundEnabled(true);
      playAlert("enabled");
      toast.success("Sons ativados: pedido e chat têm alertas diferentes.");
    } catch {
      toast.error("O navegador não permitiu ativar o som. Verifique o volume e tente novamente.");
    }
  }, [playAlert]);

  const loadCore = useCallback(async (quiet = false) => {
    try {
      const calls: Promise<Response>[] = [fetch("/api/orders", { cache: "no-store" })];
      if (viewer.role !== "production") calls.push(fetch("/api/chat", { cache: "no-store" }));
      calls.push(fetch("/api/config", { cache: "no-store" }));
      if (viewer.role === "admin") calls.push(fetch("/api/staff", { cache: "no-store" }));
      const responses = await Promise.all(calls);
      if (responses.some((response) => !response.ok)) throw new Error("Falha ao atualizar o painel.");
      let cursor = 0;
      const nextOrders = ((await responses[cursor++].json()) as { orders?: Order[] }).orders ?? [];
      const nextConversations = viewer.role !== "production"
        ? ((await responses[cursor++].json()) as { conversations?: Conversation[] }).conversations ?? []
        : [];
      const nextZones = ((await responses[cursor++].json()) as { zones?: Zone[] }).zones ?? [];
      const nextStaff = viewer.role === "admin"
        ? ((await responses[cursor++].json()) as { staff?: Staff[] }).staff ?? []
        : [];
      inspectIncoming(nextOrders, nextConversations);
      setOrders(nextOrders);
      setConversations(nextConversations);
      setZones(nextZones);
      if (viewer.role === "admin") setStaff(nextStaff);
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [inspectIncoming, viewer.role]);

  useEffect(() => {
    void loadCore();
    const interval = window.setInterval(() => void loadCore(true), 10000);
    return () => window.clearInterval(interval);
  }, [loadCore]);

  const loadMessages = useCallback(async (id: string) => {
    const response = await fetch(`/api/chat/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { messages?: Message[] };
    setMessages(data.messages ?? []);
  }, []);

  useEffect(() => {
    if (!activeConversation) return;
    void loadMessages(activeConversation);
    const interval = window.setInterval(() => void loadMessages(activeConversation), 4000);
    return () => window.clearInterval(interval);
  }, [activeConversation, loadMessages]);

  const stats = useMemo(() => ({
    newOrders: orders.filter((order) => order.status === "new").length,
    preparing: orders.filter((order) => ["confirmed", "preparing"].includes(order.status)).length,
    openChats: conversations.filter((chat) => chat.status === "open").length,
    todayTotal: orders.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString() && order.status !== "cancelled").reduce((sum, order) => sum + order.totalCents, 0),
  }), [orders, conversations]);

  return (
    <div className="min-h-screen bg-[#f3f1ed] text-[#211a18]">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#171312] text-white shadow-lg">
        <div className="mx-auto flex min-h-18 max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white px-2.5 py-2"><img src="/images/logo-colorida.png" alt="Mixology Drinkeria" className="h-6 w-auto" /></div>
            <div><p className="font-bold">Painel Mixology</p><p className="text-xs text-white/50">{roleLabels[viewer.role]}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void toggleSounds()}
              className={soundEnabled ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 hover:text-emerald-100" : "text-white/75 hover:bg-white/10 hover:text-white"}
              title={soundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros neste navegador"}
              aria-pressed={soundEnabled}
            >
              <BellRing className="h-4 w-4" />
              <span className="hidden sm:inline">{soundEnabled ? "Sons ativos" : "Ativar sons"}</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void loadCore()} className="text-white hover:bg-white/10 hover:text-white" aria-label="Atualizar painel"><RefreshCw className="h-4 w-4" /></Button>
            <a href={signOutHref} className="flex h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-sm text-white/70 hover:bg-white/10"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-sm font-bold uppercase tracking-[.12em] text-[#a1222b]">Central de operação</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Boa noite, {viewer.name.split(" ")[0]}</h1></div>
          <p className="text-sm text-[#766a65]">Atualização automática a cada 10 segundos</p>
        </div>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Bell} label="Pedidos novos" value={String(stats.newOrders)} tone="red" />
          <StatCard icon={Clock3} label="Em andamento" value={String(stats.preparing)} tone="orange" />
          <StatCard icon={MessageCircle} label="Chats abertos" value={String(stats.openChats)} tone="purple" />
          <StatCard icon={PackageCheck} label="Vendas de hoje" value={formatMoneyFromCents(stats.todayTotal)} tone="green" />
        </section>

        <Tabs defaultValue="orders" className="space-y-5">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border bg-white p-1.5 sm:w-auto">
            <TabsTrigger value="orders"><ShoppingBag /> Pedidos</TabsTrigger>
            {viewer.role !== "production" && <TabsTrigger value="chat"><MessageCircle /> Chat</TabsTrigger>}
            {viewer.role === "admin" && <TabsTrigger value="delivery"><Truck /> Entregas</TabsTrigger>}
            {viewer.role === "admin" && <TabsTrigger value="staff"><Users /> Equipe</TabsTrigger>}
          </TabsList>

          <TabsContent value="orders"><OrdersPanel orders={orders} loading={loading} onChanged={() => loadCore(true)} /></TabsContent>
          {viewer.role !== "production" && <TabsContent value="chat"><ChatPanel conversations={conversations} activeId={activeConversation} setActiveId={setActiveConversation} messages={messages} viewer={viewer} onChanged={() => loadCore(true)} onReloadMessages={loadMessages} /></TabsContent>}
          {viewer.role === "admin" && <TabsContent value="delivery"><DeliveryPanel zones={zones} onSaved={(value) => setZones(value)} /></TabsContent>}
          {viewer.role === "admin" && <TabsContent value="staff"><StaffPanel staff={staff} onChanged={() => loadCore(true)} /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}

function OrdersPanel({ orders, loading, onChanged }: { orders: Order[]; loading: boolean; onChanged: () => void }) {
  const changeStatus = async (id: string, status: string) => {
    const response = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) return toast.error("Não foi possível alterar o status.");
    toast.success("Status atualizado");
    onChanged();
  };
  if (loading) return <PanelShell><p className="p-8 text-center text-[#776b66]">Carregando pedidos…</p></PanelShell>;
  if (!orders.length) return <PanelShell><p className="p-12 text-center text-[#776b66]">Nenhum pedido recebido ainda.</p></PanelShell>;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {orders.map((order) => (
        <article key={order.id} className="rounded-3xl border border-[#e1dad5] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex items-center gap-2"><h2 className="text-lg font-extrabold">{order.orderNumber}</h2><Badge className={statusClasses[order.status]}>{statusLabels[order.status]}</Badge></div><p className="mt-1 text-sm text-[#776b66]">{order.customerName} · {formatPhone(order.customerPhone)}</p></div>
            <div className="text-right"><p className="text-xl font-extrabold text-[#a1222b]">{formatMoneyFromCents(order.totalCents)}</p><p className="text-xs text-[#8a7c76]">{formatDate(order.createdAt)}</p></div>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl bg-[#f7f4f1] p-4">
            {order.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-3 text-sm"><div><strong>{item.quantity}× {item.name}</strong>{item.details && <p className="mt-0.5 text-xs text-[#81736d]">{item.details}</p>}</div><span>{formatMoneyFromCents(item.unitPriceCents * item.quantity)}</span></div>)}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[#8a7c76]">Recebimento</dt><dd className="font-semibold">{order.fulfillmentType === "delivery" ? `Entrega · ${order.neighborhood}` : "Retirada"}</dd></div>
            <div><dt className="text-[#8a7c76]">Pagamento</dt><dd className="font-semibold">{paymentLabel(order.paymentMethod)}{order.paymentFeeCents ? ` + ${formatMoneyFromCents(order.paymentFeeCents)}` : ""}</dd></div>
            <div><dt className="text-[#8a7c76]">Previsão</dt><dd className="font-semibold">{order.etaMin}–{order.etaMax} min</dd></div>
            <div><dt className="text-[#8a7c76]">Maioridade</dt><dd className="flex items-center gap-1 font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4" /> 18+ declarado</dd></div>
          </dl>
          {order.notes && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Observação:</strong> {order.notes}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Select value={order.status} onValueChange={(status) => void changeStatus(order.id, status)}><SelectTrigger className="h-11 flex-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Button asChild variant="outline" className="h-11 rounded-xl"><a href={`https://wa.me/55${order.customerPhone.replace(/^55/, "")}?text=${encodeURIComponent(`Olá, ${order.customerName}! Aqui é da Mixology sobre o pedido ${order.orderNumber}.`)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ChatPanel({ conversations, activeId, setActiveId, messages, viewer, onChanged, onReloadMessages }: { conversations: Conversation[]; activeId: string | null; setActiveId: (id: string) => void; messages: Message[]; viewer: Viewer; onChanged: () => void; onReloadMessages: (id: string) => Promise<void> }) {
  const [reply, setReply] = useState("");
  const active = conversations.find((chat) => chat.id === activeId);
  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!activeId || !reply.trim()) return;
    const response = await fetch(`/api/chat/${activeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply }) });
    if (!response.ok) return toast.error("Não foi possível enviar a resposta.");
    setReply(""); await onReloadMessages(activeId); onChanged();
  };
  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-3xl border border-[#ded7d1] bg-white shadow-sm lg:grid-cols-[340px_1fr]">
      <aside className="border-b border-[#e5ddd8] lg:border-r lg:border-b-0">
        <div className="border-b p-4"><h2 className="font-bold">Conversas</h2><p className="text-xs text-[#81736d]">Atendimento do site em tempo quase real</p></div>
        <div className="max-h-64 overflow-y-auto lg:max-h-[560px]">
          {conversations.map((chat) => <button key={chat.id} type="button" onClick={() => setActiveId(chat.id)} className={`flex w-full items-center justify-between gap-3 border-b px-4 py-4 text-left hover:bg-[#faf7f4] ${activeId === chat.id ? "bg-[#f8ecec]" : ""}`}><div className="min-w-0"><p className="truncate font-bold">{chat.customerName}</p><p className="truncate text-xs text-[#81736d]">{chat.lastMessage}</p></div><div className="shrink-0 text-right"><span className={`inline-block h-2 w-2 rounded-full ${chat.status === "open" ? "bg-emerald-500" : "bg-gray-300"}`} /><p className="mt-1 text-[11px] text-[#8a7c76]">{shortTime(chat.lastMessageAt)}</p></div></button>)}
          {!conversations.length && <p className="p-8 text-center text-sm text-[#81736d]">Nenhuma conversa ainda.</p>}
        </div>
      </aside>
      <section className="flex min-h-[420px] flex-col">
        {active ? <><div className="flex items-center justify-between border-b px-5 py-4"><div><h3 className="font-bold">{active.customerName}</h3><p className="text-xs text-[#81736d]">{formatPhone(active.customerPhone)} · {active.assignedTo ? `Atendido por ${active.assignedTo}` : "Aguardando atendimento"}</p></div><Button asChild size="sm" variant="outline"><a href={`https://wa.me/55${active.customerPhone.replace(/^55/, "")}`} target="_blank" rel="noreferrer">WhatsApp</a></Button></div><div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f4f1] p-5">{messages.map((message) => <div key={message.id} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${message.senderType === "staff" ? "ml-auto bg-[#a1222b] text-white" : "bg-white shadow-sm"}`}><p className="text-xs font-bold opacity-60">{message.senderName}</p><p className="mt-1 whitespace-pre-wrap">{message.body}</p><p className="mt-1 text-[10px] opacity-50">{shortTime(message.createdAt)}</p></div>)}</div><form onSubmit={send} className="flex gap-2 border-t p-4"><Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder={`Responder como ${viewer.name}`} className="min-h-11 resize-none" /><Button type="submit" size="icon" className="h-11 w-11 shrink-0 bg-[#a1222b]"><Send /></Button></form></> : <div className="grid flex-1 place-items-center p-8 text-center text-[#81736d]"><div><MessageCircle className="mx-auto h-10 w-10" /><p className="mt-3 font-semibold">Selecione uma conversa</p></div></div>}
      </section>
    </div>
  );
}

function DeliveryPanel({ zones, onSaved }: { zones: Zone[]; onSaved: (zones: Zone[]) => void }) {
  const [draft, setDraft] = useState(zones);
  useEffect(() => setDraft(zones), [zones]);
  const save = async () => {
    const response = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zones: draft }) });
    const data = await response.json() as { error?: string; zones?: Zone[] };
    if (!response.ok) return toast.error(data.error || "Não foi possível salvar.");
    onSaved(data.zones ?? []); toast.success("Taxas atualizadas");
  };
  return <PanelShell><div className="border-b p-5"><h2 className="text-lg font-bold">Bairros e taxas de entrega</h2><p className="text-sm text-[#81736d]">O valor é mostrado ao cliente assim que o CEP identifica o bairro.</p></div><div className="space-y-3 p-5">{draft.map((zone, index) => <div key={`${zone.neighborhood}-${index}`} className="grid items-center gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_160px_auto]"><Input value={zone.neighborhood} onChange={(event) => setDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, neighborhood: event.target.value } : item))} aria-label="Bairro" /><Input type="number" step="0.01" min="0" value={(zone.feeCents / 100).toFixed(2)} onChange={(event) => setDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, feeCents: Math.round(Number(event.target.value) * 100) } : item))} aria-label={`Taxa de ${zone.neighborhood}`} /><label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={zone.active} onCheckedChange={(active) => setDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, active } : item))} /> Ativo</label></div>)}<div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => setDraft((current) => [...current, { neighborhood: "Novo bairro", feeCents: 1000, active: true }])}>Adicionar bairro</Button><Button type="button" onClick={() => void save()} className="bg-[#a1222b]">Salvar taxas</Button></div></div></PanelShell>;
}

function StaffPanel({ staff, onChanged }: { staff: Staff[]; onChanged: () => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState<Viewer["role"]>("service");
  const add = async (event: FormEvent) => { event.preventDefault(); const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role }) }); const data = await response.json() as { error?: string }; if (!response.ok) { toast.error(data.error || "Não foi possível cadastrar."); return; } setName(""); setEmail(""); toast.success("Funcionário cadastrado"); onChanged(); };
  const toggle = async (member: Staff) => { await fetch("/api/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id, active: !Boolean(member.active) }) }); onChanged(); };
  return <div className="grid gap-5 lg:grid-cols-[1fr_380px]"><PanelShell><div className="border-b p-5"><h2 className="text-lg font-bold">Equipe cadastrada</h2></div><div className="divide-y">{staff.map((member) => <div key={member.id} className="flex items-center justify-between gap-4 p-5"><div><p className="font-bold">{member.name}</p><p className="text-sm text-[#81736d]">{member.email} · {roleLabels[member.role]}</p></div><Button type="button" variant={member.active ? "outline" : "secondary"} size="sm" onClick={() => void toggle(member)}>{member.active ? "Desativar" : "Ativar"}</Button></div>)}{!staff.length && <p className="p-8 text-center text-sm text-[#81736d]">Além dos administradores iniciais, nenhum funcionário foi cadastrado.</p>}</div></PanelShell><PanelShell><form onSubmit={add} className="space-y-4 p-5"><div><h2 className="text-lg font-bold">Adicionar funcionário</h2><p className="text-sm text-[#81736d]">Ele entrará usando a conta ChatGPT desse e-mail.</p></div><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" required /><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" type="email" required /><Select value={role} onValueChange={(value) => setRole(value as Viewer["role"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Administrador</SelectItem><SelectItem value="service">Atendimento</SelectItem><SelectItem value="production">Produção</SelectItem></SelectContent></Select><Button type="submit" className="w-full bg-[#a1222b]">Cadastrar acesso</Button></form></PanelShell></div>;
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Bell; label: string; value: string; tone: "red" | "orange" | "purple" | "green" }) { const tones = { red: "bg-rose-100 text-rose-700", orange: "bg-orange-100 text-orange-700", purple: "bg-violet-100 text-violet-700", green: "bg-emerald-100 text-emerald-700" }; return <article className="flex items-center gap-4 rounded-2xl border border-[#e1dad5] bg-white p-4 shadow-sm"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-[#8a7c76]">{label}</p><p className="mt-1 text-2xl font-extrabold">{value}</p></div></article>; }
function PanelShell({ children }: { children: React.ReactNode }) { return <section className="overflow-hidden rounded-3xl border border-[#ded7d1] bg-white shadow-sm">{children}</section>; }
function formatDate(value: number) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Campo_Grande" }).format(new Date(value)); }
function shortTime(value: number) { return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Campo_Grande" }).format(new Date(value)); }
function formatPhone(value: string) { const digits = value.replace(/\D/g, "").replace(/^55/, ""); return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : value; }
function paymentLabel(value: string) { return value === "pix" ? "Pix" : value === "credit" ? "Crédito na entrega" : "Débito na entrega"; }
