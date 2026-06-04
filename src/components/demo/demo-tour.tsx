"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Music2,
  CalendarDays,
  ListMusic,
  Sparkles,
  Guitar,
  MapPin,
  Star,
  ArrowRight,
  Flame,
  Megaphone,
  CheckCircle2,
  Search,
  FileText,
  GripVertical,
  Link2,
  X,
  Check,
  Clock,
  Wallet,
  Target,
  Disc3,
  Copy,
  Download,
  Share2,
  ExternalLink,
  AtSign,
  Mail,
  Video,
  Image as ImageIcon,
  FileMusic,
  Map as MapIcon,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SongStatusBadge } from "@/components/shared/status-badge";
import { Teleprompter } from "@/components/shared/teleprompter";
import { cn } from "@/lib/utils";

/* =========================================================================
   DEMO 100% FICTÍCIA — banda inventada "Os Aventureiros" (Belo Horizonte).
   Tudo é interativo via estado local; NADA é salvo nem toca o banco real.
   Sem dados reais da banda, sem letras reais, sem contatos reais, sem APIs.
   ========================================================================= */

const BANDA = "Os Aventureiros";
const CIDADE = "Belo Horizonte";

/* ---------- Letra fictícia "demo" pro teleprompter (sem copyright) -------- */
const DEMO_LRC = `[00:00.00]
[00:06.00]Linha demo do verso
[00:10.00]Outra linha pra simular leitura
[00:14.00]O palco acende, a gente vai
[00:18.00]Refrão demo entrando agora
[00:22.00]A banda segue firme até o final
[00:26.00]
[00:34.00]Linha demo do verso
[00:38.00]Outra linha pra simular leitura
[00:42.00]Refrão demo entrando agora
[00:46.00]A banda segue firme até o final`;
const DEMO_CUES = JSON.stringify([
  { t: 0, label: "Introdução" },
  { t: 26, label: "Solo (demo)" },
]);
const DEMO_LYRICS =
  "Linha demo do verso\nOutra linha pra simular leitura\nO palco acende, a gente vai\nRefrão demo entrando agora\nA banda segue firme até o final";

type Status = "pronta" | "precisa_ensaiar" | "aprendendo";
type DemoSong = {
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  status: Status;
  dur: string;
  drop?: boolean;
  emenda?: boolean;
  lyrics: string | null;
  syncedLyrics?: string | null;
  cues?: string | null;
  durationSeg?: number;
};

const SONGS: DemoSong[] = [
  { n: 1, titulo: "Cidade de Neon", artista: "Os Aventureiros", tom: "G", status: "pronta", dur: "4:05", emenda: true, lyrics: DEMO_LYRICS, syncedLyrics: DEMO_LRC, cues: DEMO_CUES, durationSeg: 245 },
  { n: 2, titulo: "Trovão de Verão", artista: "Os Aventureiros", tom: "Am", status: "pronta", dur: "3:42", lyrics: DEMO_LYRICS, syncedLyrics: DEMO_LRC, cues: DEMO_CUES, durationSeg: 222 },
  { n: 3, titulo: "Coração de Aço", artista: "Os Aventureiros", tom: "E", status: "pronta", dur: "3:55", drop: true, lyrics: DEMO_LYRICS },
  { n: 4, titulo: "Estrada Sem Fim", artista: "Os Aventureiros", tom: "D", status: "precisa_ensaiar", dur: "3:18", lyrics: DEMO_LYRICS },
  { n: 5, titulo: "Last Call", artista: "The Wanderers (ref.)", tom: "C", status: "precisa_ensaiar", dur: "2:58", lyrics: null },
  { n: 6, titulo: "Noite Elétrica", artista: "Os Aventureiros", tom: "Bm", status: "aprendendo", dur: "4:12", drop: true, lyrics: null },
  { n: 7, titulo: "Sinal Vermelho", artista: "Os Aventureiros", tom: "A", status: "pronta", dur: "3:30", lyrics: DEMO_LYRICS },
];

type SetItem = { id: string; titulo: string; tom: string; dur: string; drop: boolean; emenda: boolean };
const SETLIST_INI: SetItem[] = [
  { id: "a", titulo: "Cidade de Neon", tom: "G", dur: "4:05", drop: false, emenda: true },
  { id: "b", titulo: "Trovão de Verão", tom: "Am", dur: "3:42", drop: false, emenda: false },
  { id: "c", titulo: "Coração de Aço", tom: "E", dur: "3:55", drop: true, emenda: false },
  { id: "d", titulo: "Estrada Sem Fim", tom: "D", dur: "3:18", drop: false, emenda: true },
  { id: "e", titulo: "Sinal Vermelho", tom: "A", dur: "3:30", drop: false, emenda: false },
];

const MEMBROS = ["João Vocal", "Lia Guitarra", "Rafa Baixo", "Beto Bateria"];
type Presenca = "confirmado" | "pendente" | "nao";
type AgEvent = { dia: string; mes: string; titulo: string; cidade: string; tipo: string; presencas: Presenca[] };
const AGENDA_INI: AgEvent[] = [
  { dia: "07", mes: "JUN", titulo: "Ensaio Geral", cidade: "Estúdio Garagem · BH", tipo: "Ensaio", presencas: ["confirmado", "confirmado", "pendente", "confirmado"] },
  { dia: "12", mes: "JUN", titulo: "Show no Bar do Rock", cidade: "Belo Horizonte · MG", tipo: "Show", presencas: ["confirmado", "confirmado", "confirmado", "confirmado"] },
  { dia: "21", mes: "JUN", titulo: "Festival Demo", cidade: "Cidade Demo · MG", tipo: "Festival", presencas: ["confirmado", "pendente", "pendente", "nao"] },
  { dia: "28", mes: "JUN", titulo: "Gravação de vídeo", cidade: "Estúdio Lumen · BH", tipo: "Gravação", presencas: ["confirmado", "confirmado", "pendente", "pendente"] },
];

type FinItem = { item: string; tipo: "Entrada" | "Despesa"; valor: string; quem: string; status: string };
const FIN_ITENS: FinItem[] = [
  { item: "Cachê do show", tipo: "Entrada", valor: "R$ 1.200", quem: "Contratante", status: "Recebido" },
  { item: "Transporte", tipo: "Despesa", valor: "R$ 180", quem: "Beto Bateria", status: "Pago" },
  { item: "Aluguel de PA", tipo: "Despesa", valor: "R$ 300", quem: "Banda", status: "Pago" },
  { item: "Impulsionamento", tipo: "Despesa", valor: "R$ 50", quem: "Lia Guitarra", status: "Pendente" },
  { item: "Água e gelo", tipo: "Despesa", valor: "Cortesia", quem: "Casa", status: "—" },
];

const PRESSKIT = [
  { icon: FileText, t: "Bio curta", d: "1 parágrafo pronto pra mandar no direct." },
  { icon: FileText, t: "Bio completa", d: "Release completo pra imprensa e contratante." },
  { icon: ImageIcon, t: "Fotos oficiais", d: "8 fotos em alta, prontas pra divulgação." },
  { icon: Video, t: "Vídeos ao vivo", d: "3 vídeos de show pra mostrar a banda no palco." },
  { icon: Flame, t: "Logo", d: "Logo em PNG, fundo claro e escuro." },
  { icon: FileMusic, t: "Rider técnico", d: "Necessidades de palco, som e backline." },
  { icon: MapIcon, t: "Mapa de palco", d: "Posições da banda pro técnico de som." },
  { icon: Link2, t: "Links sociais", d: "Instagram, YouTube e streaming num lugar só." },
  { icon: Mail, t: "Contato p/ contratação", d: "E-mail e telefone direto pra fechar shows." },
];

type Funil = { col: string; cards: { nome: string; cidade: string; contato: string; ultimo: string; follow: string; material: string }[] };
const FUNIL: Funil[] = [
  { col: "Novo contato", cards: [{ nome: "Pub Central", cidade: "BH", contato: "Diego", ultimo: "30/05", follow: "06/06", material: "—" }] },
  { col: "Material enviado", cards: [{ nome: "Bar do Rock", cidade: "Belo Horizonte", contato: "Marina", ultimo: "28/05", follow: "04/06", material: "Press kit + vídeo ao vivo" }] },
  { col: "Aguardando resposta", cards: [{ nome: "Mulligan's Demo", cidade: "Contagem", contato: "Sr. Paulo", ultimo: "25/05", follow: "03/06", material: "Press kit" }] },
  { col: "Negociando data", cards: [{ nome: "Casa 299 Demo", cidade: "BH", contato: "Bruna", ultimo: "29/05", follow: "02/06", material: "Press kit + rider" }] },
  { col: "Fechado", cards: [{ nome: "Festival Independente", cidade: "Nova Lima", contato: "Org. Festival", ultimo: "27/05", follow: "—", material: "Contrato assinado" }] },
];

const REFERENCIAS = [
  { musica: "Cidade de Neon", ref: "Referência de pop rock anos 80", cor: "from-fuchsia-600/40 to-cyan-500/30" },
  { musica: "Trovão de Verão", ref: "Referência de rock de estádio", cor: "from-amber-500/40 to-red-600/30" },
  { musica: "Coração de Aço", ref: "Referência de hard rock clássico", cor: "from-zinc-500/40 to-zinc-800/40" },
];

const MODULOS = [
  { id: "repertorio", label: "Repertório" },
  { id: "setlist", label: "Setlist" },
  { id: "agenda", label: "Agenda" },
  { id: "financeiro", label: "Financeiro" },
  { id: "presskit", label: "Press Kit" },
  { id: "prospeccao", label: "Prospecção" },
];

/* ========================================================================= */

function Section({ id, icon: Icon, kicker, title, children }: { id?: string; icon: React.ComponentType<{ className?: string }>; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-4xl scroll-mt-28 px-4 py-10">
      <div className="mb-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          <Icon className="size-4" /> {kicker}
        </p>
        <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ---------- Repertório ---------------------------------------------------- */
const STATUS_CHIPS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pronta", label: "Prontas" },
  { key: "precisa_ensaiar", label: "Precisa ensaiar" },
  { key: "aprendendo", label: "Aprendendo" },
];

function RepertorioDemo() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Status | "all">("all");
  const [letra, setLetra] = useState<DemoSong | null>(null);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return SONGS.filter(
      (s) => (filtro === "all" || s.status === filtro) && (!t || s.titulo.toLowerCase().includes(t) || s.artista.toLowerCase().includes(t))
    );
  }, [q, filtro]);

  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar música ou artista…" className="pl-9" />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS_CHIPS.map((c) => (
          <button key={c.key} onClick={() => setFiltro(c.key)} className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors", filtro === c.key ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-border hover:text-foreground")}>
            {c.label}
          </button>
        ))}
      </div>
      <Card className="divide-y divide-border overflow-hidden p-0">
        {lista.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nada encontrado pra “{q}”.</p>
        ) : (
          lista.map((s) => (
            <div key={s.n} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{s.artista}</p>
              </div>
              {s.drop && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-inset ring-amber-500/30">DROP</span>}
              {s.emenda && <span className="hidden text-xs text-primary sm:inline" title="Emenda na próxima">↘ emenda</span>}
              <SongStatusBadge status={s.status} />
              {s.tom && <span className="hidden w-8 text-center font-mono text-xs text-muted-foreground sm:inline">{s.tom}</span>}
              <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">{s.dur}</span>
              <button onClick={() => setLetra(s)} className="inline-flex size-7 items-center justify-center rounded-full text-sky-400 transition-colors hover:bg-sky-500/15" title="Ver letra">
                <FileText className="size-3.5" />
              </button>
              <span className="inline-flex size-7 items-center justify-center rounded-full text-orange-400" title="Cifra (no app completo)">
                <Guitar className="size-3.5" />
              </span>
            </div>
          ))
        )}
      </Card>

      <Dialog open={!!letra} onOpenChange={(o) => !o && setLetra(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{letra?.titulo}</DialogTitle>
            <DialogDescription>{letra?.artista}{letra?.tom ? ` · tom ${letra.tom}` : ""}</DialogDescription>
          </DialogHeader>
          {letra?.lyrics ? (
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed">{letra.lyrics}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">Letra ainda não cadastrada — no app completo, o StageBoss busca a letra (e a versão sincronizada) automaticamente.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- Setlist + Teleprompter --------------------------------------- */
function SortableSetRow({ item, index, onDrop, onEmenda, isLast }: { item: SetItem; index: number; onDrop: () => void; onEmenda: () => void; isLast: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-2 bg-card px-3 py-2.5", isDragging && "z-10 shadow-lg ring-1 ring-primary/40")}>
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing" title="Arrastar pra reordenar" aria-label="Arrastar">
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 text-right font-mono text-sm text-muted-foreground">{index + 1}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.titulo}</p></div>
      <button onClick={onDrop} className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset transition-colors", item.drop ? "bg-amber-500/15 text-amber-300 ring-amber-500/30" : "text-muted-foreground ring-border hover:text-amber-300")} title="Afinação dropada (toque pra alternar)">
        DROP
      </button>
      {!isLast && (
        <button onClick={onEmenda} className={cn("inline-flex size-7 items-center justify-center rounded-full transition-colors", item.emenda ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-primary")} title="Emenda na próxima (toque pra alternar)">
          <Link2 className="size-4" />
        </button>
      )}
      <span className="w-8 text-center font-mono text-xs text-muted-foreground">{item.tom}</span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{item.dur}</span>
    </div>
  );
}

function SetlistDemo() {
  const [items, setItems] = useState<SetItem[]>(SETLIST_INI);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setItems((prev) => arrayMove(prev, prev.findIndex((i) => i.id === active.id), prev.findIndex((i) => i.id === over.id)));
    }
  }
  const toggle = (id: string, key: "drop" | "emenda") => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [key]: !i[key] } : i)));

  const tpSongs = items
    .map((it, idx) => {
      const s = SONGS.find((x) => x.titulo === it.titulo);
      return s ? { ...s, n: idx + 1 } : null;
    })
    .filter((s): s is DemoSong => s !== null);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-border">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted-foreground" />
          <span className="font-semibold">Show no Bar do Rock</span>
          <span className="text-muted-foreground">· 12/jun · {CIDADE}</span>
        </div>
        <Teleprompter songs={tpSongs} label="Abrir teleprompter demo" />
      </div>
      <Card className="overflow-hidden p-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-border">
              {items.map((it, idx) => (
                <SortableSetRow key={it.id} item={it} index={idx} isLast={idx === items.length - 1} onDrop={() => toggle(it.id, "drop")} onEmenda={() => toggle(it.id, "emenda")} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </Card>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        👆 <strong>Arraste</strong> pra reordenar, toque em <strong>DROP</strong>/<strong>emenda</strong>, e abra o <strong>teleprompter</strong>: tem Iniciar, Pausar, Mais rápido/devagar, Tela cheia e <strong>Sync</strong> (rola no tempo da música).
      </p>
    </>
  );
}

/* ---------- Agenda (presença em 3 estados) -------------------------------- */
const PRES_NEXT: Record<Presenca, Presenca> = { confirmado: "nao", nao: "pendente", pendente: "confirmado" };
const PRES_UI: Record<Presenca, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  confirmado: { label: "Confirmado", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", icon: Check },
  pendente: { label: "Pendente", cls: "text-muted-foreground ring-border", icon: Clock },
  nao: { label: "Não vai", cls: "bg-red-500/15 text-red-300 ring-red-500/30", icon: X },
};

function AgendaDemo() {
  const [agenda, setAgenda] = useState<AgEvent[]>(AGENDA_INI);
  const cycle = (ei: number, mi: number) =>
    setAgenda((prev) => prev.map((e, i) => (i === ei ? { ...e, presencas: e.presencas.map((p, j) => (j === mi ? PRES_NEXT[p] : p)) } : e)));

  return (
    <div className="space-y-2">
      {agenda.map((e, ei) => {
        const n = e.presencas.filter((p) => p === "confirmado").length;
        const todos = n === MEMBROS.length;
        return (
          <Card key={ei} className="p-3 transition-colors hover:bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <span className="text-lg font-black leading-none">{e.dia}</span>
                <span className="text-[10px] font-bold uppercase text-primary">{e.mes}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{e.tipo} · {e.cidade}</p>
              </div>
              <div className="text-right">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", todos ? "bg-emerald-500/15 text-emerald-300" : "bg-blue-500/15 text-blue-300")}>
                  {todos && <CheckCircle2 className="size-3" />}
                  {todos ? "Todos confirmados" : "Aguardando"}
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground"><Star className="mr-0.5 inline size-3 fill-amber-400 text-amber-400" />{n}/{MEMBROS.length} confirmados</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              {MEMBROS.map((m, mi) => {
                const p = e.presencas[mi];
                const ui = PRES_UI[p];
                return (
                  <button key={mi} onClick={() => cycle(ei, mi)} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors", ui.cls)} title="Toque pra alternar: Confirmado → Não vai → Pendente">
                    <ui.icon className="size-3" />{m}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
      <p className="text-center text-xs text-muted-foreground">👆 Toque nos nomes pra alternar a presença — o contador atualiza na hora.</p>
    </div>
  );
}

/* ---------- Financeiro por show ------------------------------------------- */
function FinanceiroDemo() {
  const cards = [
    { label: "Cachê", valor: "R$ 1.200", cls: "text-emerald-300" },
    { label: "Despesas", valor: "R$ 530", cls: "text-red-300" },
    { label: "Saldo líquido", valor: "R$ 670", cls: "text-foreground" },
    { label: "Divisão por membro", valor: "R$ 167,50", cls: "text-foreground" },
  ];
  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <MapPin className="size-4 text-muted-foreground" />
        <span className="font-semibold">Show no Bar do Rock</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Pagamento pendente</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4 transition-colors hover:bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className={cn("mt-1 text-xl font-black tabular-nums", c.cls)}>{c.valor}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <span>Item</span>
          <span className="hidden text-right sm:block">Tipo</span>
          <span className="text-right">Valor</span>
          <span className="hidden text-right sm:block">Quem pagou</span>
          <span className="text-right">Status</span>
        </div>
        {FIN_ITENS.map((it) => (
          <div key={it.item} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border px-3 py-2.5 text-sm last:border-0 sm:grid-cols-[1fr_auto_auto_auto_auto]">
            <span className="truncate font-medium">{it.item}</span>
            <span className={cn("hidden text-right text-xs sm:block", it.tipo === "Entrada" ? "text-emerald-300" : "text-muted-foreground")}>{it.tipo}</span>
            <span className="text-right font-mono tabular-nums">{it.valor}</span>
            <span className="hidden truncate text-right text-xs text-muted-foreground sm:block">{it.quem}</span>
            <span className="text-right text-xs">{it.status}</span>
          </div>
        ))}
      </Card>
      <div className="mt-3 flex justify-center">
        <Button variant="outline" size="sm" onClick={() => toast.success("Perfil financeiro atualizado na demo")}>
          <Wallet className="size-4" /> Marcar como pago (demo)
        </Button>
      </div>
    </>
  );
}

/* ---------- Press kit ----------------------------------------------------- */
const BIO_CURTA = `${BANDA} é uma banda de ${CIDADE} que mistura rock alternativo, pop rock e clássicos de palco. Energia de show grande pra bares, casas e festivais.`;
const MSG_CONTRATANTE = `Olá! Somos ${BANDA}, banda de rock de ${CIDADE}. Segue nosso press kit com release, fotos, vídeos ao vivo e rider técnico. Temos disponibilidade pra shows — podemos conversar sobre data e cachê?`;

function copy(text: string, msg: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success(msg)).catch(() => toast.success(msg));
}

function PressKitDemo() {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_320px]">
      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRESSKIT.map((m) => (
            <Card key={m.t} className="flex items-start gap-3 p-3.5 transition-all hover:-translate-y-0.5 hover:ring-primary/40">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"><m.icon className="size-5" /></div>
              <div className="min-w-0"><p className="text-sm font-semibold">{m.t}</p><p className="mt-0.5 text-xs text-muted-foreground">{m.d}</p></div>
            </Card>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => copy(BIO_CURTA, "Bio copiada na demo")}><Copy className="size-4" /> Copiar bio</Button>
          <Button size="sm" variant="outline" onClick={() => toast.success("Press kit baixado na demo")}><Download className="size-4" /> Baixar press kit</Button>
          <Button size="sm" variant="outline" onClick={() => toast.success("Link público aberto na demo")}><ExternalLink className="size-4" /> Abrir link público</Button>
          <Button size="sm" variant="outline" onClick={() => copy(MSG_CONTRATANTE, "Mensagem pro contratante copiada na demo")}><Copy className="size-4" /> Copiar mensagem p/ contratante</Button>
        </div>
      </div>

      {/* Preview do press kit */}
      <Card className="overflow-hidden p-0">
        <div className="relative h-32 bg-[radial-gradient(120%_120%_at_50%_-10%,rgba(220,38,38,0.55),transparent_60%),linear-gradient(180deg,#1a1014,#09090b)]">
          <div className="absolute bottom-3 left-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">Press kit</p>
            <h3 className="text-2xl font-black leading-none">{BANDA}</h3>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">{CIDADE} · Rock alternativo, pop rock e clássicos de palco</p>
          <p className="text-sm leading-relaxed">{BIO_CURTA}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><AtSign className="size-3.5" /> @osaventureirosdemo</span>
            <span className="inline-flex items-center gap-1"><Mail className="size-3.5" /> contato@demo.com</span>
          </div>
          <Button size="sm" className="w-full" onClick={() => copy("https://stageboss.app/presskit/demo", "Link do press kit copiado na demo")}>
            <Share2 className="size-4" /> Compartilhar press kit
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Prospecção (funil) -------------------------------------------- */
function ProspeccaoDemo() {
  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {FUNIL.map((f) => (
          <div key={f.col} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{f.col}</span>
              <span className="text-[11px] text-muted-foreground">{f.cards.length}</span>
            </div>
            <div className="space-y-2">
              {f.cards.map((c) => (
                <Card key={c.nome} className="space-y-1.5 p-3 transition-all hover:-translate-y-0.5 hover:ring-primary/40">
                  <p className="text-sm font-semibold">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.cidade} · {c.contato}</p>
                  <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span>Último: {c.ultimo}</span>
                    <span>Follow up: {c.follow}</span>
                  </div>
                  <p className="text-[11px]"><span className="text-muted-foreground">Material:</span> {c.material}</p>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">← arraste a lista pro lado pra ver todo o funil →</p>
    </>
  );
}

/* ---------- Referências musicais ------------------------------------------ */
function ReferenciasDemo() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {REFERENCIAS.map((r) => (
        <Card key={r.musica} className="overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:ring-primary/40">
          <div className={cn("flex aspect-video items-center justify-center bg-linear-to-br", r.cor)}>
            <Disc3 className="size-10 text-white/70" />
          </div>
          <div className="space-y-2 p-3">
            <p className="text-sm font-semibold">{r.musica}</p>
            <p className="text-xs text-muted-foreground">{r.ref}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success("Referência aberta na demo")}><ExternalLink className="size-3.5" /> Abrir</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success("Referência vinculada na demo")}><Link2 className="size-3.5" /> Vincular</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ========================================================================= */

export function DemoTour() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Cabeçalho fixo: aviso de demo + navegação por módulos */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs font-semibold text-amber-300">
          ✨ MODO DEMONSTRAÇÃO — dados fictícios de “{BANDA}”. Pode mexer à vontade: nada é salvo.
        </div>
        <nav className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-3 py-2">
          {MODULOS.map((m) => (
            <a key={m.id} href={`#${m.id}`} className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {m.label}
            </a>
          ))}
        </nav>
      </div>

      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-primary/20 via-background to-background" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
          <div className="mx-auto mb-6 inline-flex size-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30"><Flame className="size-8 text-primary" /></div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">StageBoss</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            O painel da sua banda pra organizar repertório, montar setlists, abrir o teleprompter,
            confirmar presença, controlar cachês e divulgar shows em minutos.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Tudo funciona em modo demonstração. Busque músicas, monte um setlist, abra o teleprompter,
            veja o financeiro, explore o press kit e acompanhe oportunidades de shows.
          </p>
          <p className="mt-4 text-sm font-medium text-foreground">
            Chega de organizar a banda por WhatsApp, planilha e memória.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#repertorio"><Button size="lg">Entrar no tour <ArrowRight className="size-4" /></Button></a>
            <a href="#repertorio"><Button size="lg" variant="outline">Ver módulos</Button></a>
          </div>
        </div>
      </header>

      <Section id="repertorio" icon={Music2} kicker="Repertório" title="Todas as músicas, organizadas">
        <p className="mb-4 text-sm text-muted-foreground">Organize todas as músicas da banda com status, tom, duração, observações e filtros rápidos.</p>
        <RepertorioDemo />
      </Section>

      <Section id="setlist" icon={ListMusic} kicker="Setlist & Teleprompter" title="Monte o show e suba no palco com segurança">
        <p className="mb-4 text-sm text-muted-foreground">Monte a ordem do show, marque emendas e afinações alternativas, e abra o teleprompter no palco com segurança.</p>
        <SetlistDemo />
      </Section>

      <Section id="agenda" icon={CalendarDays} kicker="Agenda" title="Eventos e confirmação de presença">
        <p className="mb-4 text-sm text-muted-foreground">Crie eventos, avise a banda e veja rapidamente quem confirmou presença.</p>
        <AgendaDemo />
      </Section>

      <Section id="financeiro" icon={Wallet} kicker="Financeiro por show" title="Cachê, despesas e divisão — por evento">
        <p className="mb-4 text-sm text-muted-foreground">Controle cachês, despesas e divisão por evento sem depender de planilhas soltas.</p>
        <FinanceiroDemo />
      </Section>

      <Section id="presskit" icon={Megaphone} kicker="Press kit da banda" title="Tudo pra fechar show num lugar só">
        <p className="mb-4 text-sm text-muted-foreground">Mantenha fotos, vídeos, release, logo, rider técnico e links em um só lugar pra enviar rapidamente pra bares, casas e contratantes.</p>
        <PressKitDemo />
      </Section>

      <Section id="prospeccao" icon={Target} kicker="Prospecção de shows" title="Um funil simples pra fechar mais shows">
        <p className="mb-4 text-sm text-muted-foreground">Organize bares, casas e eventos num funil simples. Saiba quem já recebeu material, quem respondeu e quem precisa de follow up.</p>
        <ProspeccaoDemo />
      </Section>

      <Section icon={Disc3} kicker="Referências musicais" title="Todo mundo ensaiando a mesma versão">
        <p className="mb-4 text-sm text-muted-foreground">Vincule cada música a uma referência externa pra todos os membros ensaiarem a mesma versão.</p>
        <ReferenciasDemo />
      </Section>

      {/* CTA FINAL */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6">
        <Card className="bg-linear-to-br from-primary/15 to-background p-8 text-center ring-1 ring-primary/20">
          <Sparkles className="mx-auto mb-3 size-8 text-primary" />
          <h2 className="mx-auto max-w-xl text-2xl font-bold sm:text-3xl">
            O StageBoss centraliza a operação da banda: do repertório ao palco, da divulgação ao fechamento de novos shows.
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href="#repertorio"><Button size="lg">Testar demo <ArrowRight className="size-4" /></Button></a>
            <Button size="lg" variant="outline" onClick={() => toast.success("No app real, isso abriria o contato pra falar sobre a sua banda 🤘")}>
              Falar sobre minha banda
            </Button>
          </div>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">StageBoss · feito por músicos, pra músicos · demonstração com dados fictícios.</p>
        <p className="mt-1 text-center text-[11px] text-muted-foreground/70">
          Dados de BPM por{" "}
          <a href="https://getsongbpm.com" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            GetSongBPM
          </a>
          .
        </p>
      </section>
    </div>
  );
}
