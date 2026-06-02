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
  Wallet,
  Building2,
  Bell,
  Smartphone,
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
   DADOS 100% FICTÍCIOS — banda inventada "Os Aventureiros".
   Tudo abaixo é interativo de verdade (estado local), mas nada toca o banco.
   ========================================================================= */

const BANDA = "Os Aventureiros";

type Status = "pronta" | "precisa_ensaiar" | "aprendendo";
type DemoSong = {
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  status: Status;
  dur: string;
  lyrics: string | null;
  syncedLyrics?: string | null;
  cues?: string | null;
  durationSeg?: number;
};

// Música fictícia COM letra sincronizada de verdade (LRC) — pro Inteliprompter
// rolar no tempo certo, como o Spotify. Tudo original/inventado (sem copyright).
const TROVAO_LRC = `[00:00.00]
[00:11.00]Acende a noite, vem comigo
[00:14.50]O céu inteiro é nosso abrigo
[00:18.00]Corre na estrada sem temer
[00:21.50]O trovão de verão vai te trazer
[00:25.00]
[00:39.00]Pisa no acelerador
[00:42.50]Deixa pra trás todo o temor
[00:46.00]A gente brilha quando escurece
[00:49.50]E o mundo inteiro estremece
[00:53.00]
[01:07.00]Acende a noite, vem comigo
[01:10.50]O céu inteiro é nosso abrigo`;

const TROVAO_CUES = JSON.stringify([
  { t: 0, label: "Introdução" },
  { t: 25, label: "Solo de guitarra" },
  { t: 53, label: "Ponte / instrumental" },
]);

const SONGS: DemoSong[] = [
  {
    n: 1,
    titulo: "Trovão de Verão",
    artista: "Os Aventureiros",
    tom: "Am",
    status: "pronta",
    dur: "3:42",
    lyrics:
      "Acende a noite, vem comigo\nO céu inteiro é nosso abrigo\nCorre na estrada sem temer\nO trovão de verão vai te trazer\n\nPisa no acelerador\nDeixa pra trás todo o temor\nA gente brilha quando escurece\nE o mundo inteiro estremece",
    syncedLyrics: TROVAO_LRC,
    cues: TROVAO_CUES,
    durationSeg: 222,
  },
  {
    n: 2,
    titulo: "Cidade de Neon",
    artista: "Os Aventureiros",
    tom: "G",
    status: "pronta",
    dur: "4:05",
    lyrics:
      "Luzes piscam na avenida\nCada esquina, uma saída\nVou te encontrar na cidade de neon\nOnde a noite nunca dorme, é o nosso som",
    syncedLyrics: `[00:00.00]
[00:09.00]Luzes piscam na avenida
[00:13.00]Cada esquina, uma saída
[00:17.00]Vou te encontrar na cidade de neon
[00:21.50]Onde a noite nunca dorme, é o nosso som`,
    cues: JSON.stringify([{ t: 0, label: "Introdução" }]),
    durationSeg: 245,
  },
  { n: 3, titulo: "Estrada Sem Fim", artista: "Os Aventureiros", tom: "D", status: "precisa_ensaiar", dur: "3:18", lyrics: "Mais um quilômetro, mais um refrão\nA estrada sem fim é a nossa canção" },
  { n: 4, titulo: "Coração de Aço", artista: "Os Aventureiros", tom: "E", status: "pronta", dur: "3:55", lyrics: null },
  { n: 5, titulo: "Tempestade", artista: "Os Aventureiros", tom: "Bm", status: "aprendendo", dur: "4:30", lyrics: null },
  { n: 6, titulo: "Last Call", artista: "The Wanderers", tom: "C", status: "precisa_ensaiar", dur: "2:58", lyrics: null },
];

type SetItem = { id: string; titulo: string; tom: string; dur: string; drop: boolean; emenda: boolean };
const SETLIST_INI: SetItem[] = [
  { id: "a", titulo: "Cidade de Neon", tom: "G", dur: "4:05", drop: false, emenda: true },
  { id: "b", titulo: "Trovão de Verão", tom: "Am", dur: "3:42", drop: false, emenda: false },
  { id: "c", titulo: "Coração de Aço", tom: "E", dur: "3:55", drop: true, emenda: false },
  { id: "d", titulo: "Estrada Sem Fim", tom: "D", dur: "3:18", drop: false, emenda: false },
  { id: "e", titulo: "Last Call", tom: "C", dur: "2:58", drop: false, emenda: false },
];

const MEMBROS = ["Téo", "Bia", "Léo", "Rui", "Duda"];
type AgEvent = { dia: string; mes: string; titulo: string; cidade: string; tipo: string; confirmados: boolean[] };
const AGENDA_INI: AgEvent[] = [
  { dia: "12", mes: "JUN", titulo: "Bar do Rock", cidade: "São Paulo · SP", tipo: "Show", confirmados: [true, true, true, true, true] },
  { dia: "19", mes: "JUN", titulo: "Ensaio geral", cidade: "Estúdio Garagem", tipo: "Ensaio", confirmados: [true, true, false, true, false] },
  { dia: "28", mes: "JUN", titulo: "Festival de Inverno", cidade: "Campos do Jordão · SP", tipo: "Show", confirmados: [true, false, false, true, false] },
];

const FLYER_TEMAS = [
  { nome: "Fogo", grad: "from-primary/30 via-background to-amber-500/20", accent: "text-amber-300", data: "text-primary" },
  { nome: "Neon", grad: "from-fuchsia-600/30 via-background to-cyan-500/20", accent: "text-cyan-300", data: "text-fuchsia-400" },
  { nome: "Clássico", grad: "from-zinc-700/40 via-background to-zinc-900", accent: "text-zinc-300", data: "text-white" },
];

/* ========================================================================= */

function Section({ icon: Icon, kicker, title, children }: { icon: React.ComponentType<{ className?: string }>; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
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

/* ---------- Repertório: busca + filtro de status + letra (diálogo) -------- */
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
      (s) =>
        (filtro === "all" || s.status === filtro) &&
        (!t || s.titulo.toLowerCase().includes(t) || s.artista.toLowerCase().includes(t))
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
          <button
            key={c.key}
            onClick={() => setFiltro(c.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors",
              filtro === c.key ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-border hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Card className="divide-y divide-border overflow-hidden p-0">
        {lista.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nada encontrado pra “{q}”.</p>
        ) : (
          lista.map((s) => (
            <div key={s.n} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{s.artista}</p>
              </div>
              <SongStatusBadge status={s.status} />
              {s.tom && <span className="hidden w-8 text-center font-mono text-xs text-muted-foreground sm:inline">{s.tom}</span>}
              <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">{s.dur}</span>
              <button
                onClick={() => setLetra(s)}
                className="inline-flex size-7 items-center justify-center rounded-full text-sky-400 transition-colors hover:bg-sky-500/15"
                title="Ver letra"
              >
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
            <DialogDescription>
              {letra?.artista}{letra?.tom ? ` · tom ${letra.tom}` : ""}
            </DialogDescription>
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

/* ---------- Setlist: arrastar pra reordenar + toggles DROP/emenda --------- */
function SortableSetRow({ item, index, onDrop, onEmenda, isLast }: { item: SetItem; index: number; onDrop: () => void; onEmenda: () => void; isLast: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 bg-card px-3 py-2.5", isDragging && "z-10 shadow-lg ring-1 ring-primary/40")}
    >
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing" title="Arrastar pra reordenar" aria-label="Arrastar">
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 text-right font-mono text-sm text-muted-foreground">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.titulo}</p>
      </div>
      <button
        onClick={onDrop}
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset transition-colors",
          item.drop ? "bg-amber-500/15 text-amber-300 ring-amber-500/30" : "text-muted-foreground ring-border hover:text-amber-300"
        )}
        title="Afinação dropada (toque pra alternar)"
      >
        DROP
      </button>
      {!isLast && (
        <button
          onClick={onEmenda}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full transition-colors",
            item.emenda ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-primary"
          )}
          title="Emenda na próxima (toque pra alternar)"
        >
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const from = prev.findIndex((i) => i.id === active.id);
        const to = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, from, to);
      });
    }
  }
  const toggle = (id: string, key: "drop" | "emenda") =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [key]: !i[key] } : i)));

  // Reordena as músicas do teleprompter conforme o setlist (com letra sincronizada na frente).
  const tpSongs = items
    .map((it, idx) => {
      const s = SONGS.find((x) => x.titulo === it.titulo);
      return s ? { ...s, n: idx + 1 } : null;
    })
    .filter((s): s is DemoSong => s !== null);

  return (
    <>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-border">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted-foreground" />
          <span className="font-semibold">Bar do Rock</span>
          <span className="text-muted-foreground">· 12/jun · São Paulo</span>
        </div>
        <Teleprompter songs={tpSongs} label="Teleprompter" />
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
        👆 <strong>Arraste</strong> pra reordenar, toque em <strong>DROP</strong>/<strong>emenda</strong>, e abra o <strong>Teleprompter</strong> → botão <strong>Sync</strong> (rola no tempo da música, ao vivo).
      </p>
    </>
  );
}

/* ---------- Agenda: confirmar presença (clicável) ------------------------- */
function AgendaDemo() {
  const [agenda, setAgenda] = useState<AgEvent[]>(AGENDA_INI);
  const toggle = (ei: number, mi: number) =>
    setAgenda((prev) => prev.map((e, i) => (i === ei ? { ...e, confirmados: e.confirmados.map((c, j) => (j === mi ? !c : c)) } : e)));

  return (
    <div className="space-y-2">
      {agenda.map((e, ei) => {
        const n = e.confirmados.filter(Boolean).length;
        const todos = n === MEMBROS.length;
        return (
          <Card key={ei} className="p-3">
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
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <Star className="mr-0.5 inline size-3 fill-amber-400 text-amber-400" />
                  {n}/{MEMBROS.length} confirmados
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              {MEMBROS.map((m, mi) => {
                const ok = e.confirmados[mi];
                return (
                  <button
                    key={mi}
                    onClick={() => toggle(ei, mi)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                      ok ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "text-muted-foreground ring-border hover:text-foreground"
                    )}
                    title={ok ? "Confirmado — toque pra desmarcar" : "Toque pra confirmar presença"}
                  >
                    {ok ? <Check className="size-3" /> : <X className="size-3 opacity-50" />}
                    {m}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
      <p className="text-center text-xs text-muted-foreground">👆 Toque nos nomes pra confirmar/desmarcar — o contador atualiza na hora.</p>
    </div>
  );
}

/* ---------- Divulgação: flyer com texto editável + troca de fundo/foto ---- */
const FLYER_FOTOS = [
  { nome: "Palco", css: "bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(220,38,38,0.5),transparent_60%),linear-gradient(180deg,#1a1014,#09090b)]" },
  { nome: "Plateia", css: "bg-[radial-gradient(100%_80%_at_50%_120%,rgba(168,85,247,0.45),transparent_60%),linear-gradient(180deg,#0b0f1a,#09090b)]" },
  { nome: "Luzes", css: "bg-[conic-gradient(from_180deg_at_50%_50%,rgba(34,211,238,0.25),rgba(217,70,239,0.25),rgba(245,158,11,0.25),rgba(34,211,238,0.25))]" },
];

function Editavel({ children, className }: { children: string; className?: string }) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={cn("cursor-text rounded outline-none ring-amber-400/60 focus:ring-2", className)}
      title="Toque pra editar"
    >
      {children}
    </span>
  );
}

function FlyerDemo() {
  const [t, setT] = useState(0);
  const [foto, setFoto] = useState(0);
  const tema = FLYER_TEMAS[t];
  return (
    <>
      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Estilo</p>
        <div className="flex flex-wrap gap-2">
          {FLYER_TEMAS.map((f, i) => (
            <button key={i} onClick={() => setT(i)} className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors", t === i ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-border hover:text-foreground")}>
              {f.nome}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Foto de fundo</p>
        <div className="flex flex-wrap gap-2">
          {FLYER_FOTOS.map((f, i) => (
            <button
              key={i}
              onClick={() => setFoto(i)}
              className={cn("size-12 overflow-hidden rounded-lg ring-2 transition-all", f.css, foto === i ? "ring-primary" : "ring-border hover:ring-muted-foreground")}
              title={f.nome}
              aria-label={f.nome}
            />
          ))}
        </div>
      </div>
      <div className={cn("relative mx-auto aspect-4/5 w-full max-w-xs overflow-hidden rounded-2xl ring-1 ring-border", FLYER_FOTOS[foto].css)}>
        <div className={cn("absolute inset-0 bg-linear-to-br opacity-80", tema.grad)} />
        <div className="relative flex h-full flex-col justify-between p-6 text-center">
          <div>
            <p className={cn("text-xs font-bold uppercase tracking-[0.3em]", tema.accent)}><Editavel>AO VIVO</Editavel></p>
            <h3 className="mt-2 text-4xl font-black leading-none"><Editavel>{BANDA}</Editavel></h3>
          </div>
          <div>
            <p className={cn("text-5xl font-black", tema.data)}><Editavel>12 JUN</Editavel></p>
            <p className="mt-1 text-sm font-semibold"><Editavel>Bar do Rock · São Paulo</Editavel></p>
          </div>
          <p className="text-xs text-white/70"><Editavel>22h · Entrada solidária</Editavel></p>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">👆 Troque o <strong>estilo</strong> e a <strong>foto</strong>, e <strong>toque nos textos</strong> pra editar — tudo ao vivo.</p>
    </>
  );
}

/* ---------- "E tem muito mais": vitrine dos recursos pesados --------------- */
const MAIS = [
  { icon: Sparkles, t: "Setlist por IA", d: "Gera a ordem ideal pela curva de energia da casa e do público." },
  { icon: Music2, t: "Teleprompter inteligente", d: "Letra sincronizada (estilo Spotify) + marcações de entrada e solo." },
  { icon: Wallet, t: "Gestão financeira", d: "Cachê, divisão por músico, comissão, comprovantes e lucro por show." },
  { icon: Building2, t: "Casas & CRM", d: "Histórico por casa, perfil do público e compatibilidade com a banda." },
  { icon: Bell, t: "Avisos automáticos", d: "Push pra banda confirmar presença, com cobrança até todo mundo responder." },
  { icon: Smartphone, t: "App instalável (PWA)", d: "Funciona offline, instala no celular e abre como app de verdade." },
];

function MaisGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {MAIS.map((m, i) => (
        <Card key={i} className="flex items-start gap-3 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <m.icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{m.t}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.d}</p>
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
      {/* Banner fixo: deixa claro que é demonstração */}
      <div className="sticky top-0 z-30 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-300 backdrop-blur">
        ✨ MODO DEMONSTRAÇÃO — dados fictícios da banda “{BANDA}”. Pode mexer à vontade: nada é salvo.
      </div>

      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-primary/20 via-background to-background" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
          <div className="mx-auto mb-6 inline-flex size-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
            <Flame className="size-8 text-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">StageBoss</h1>
          <p className="mt-3 text-lg text-muted-foreground sm:text-xl">
            O painel completo da sua banda: repertório, setlists, teleprompter,
            agenda com confirmação de presença e flyer pronto pra postar.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tudo aqui <strong className="text-foreground">funciona de verdade</strong> — busque, arraste, confirme presença, abra o teleprompter. Role e experimente. 👇
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#repertorio">
              <Button size="lg">
                Entrar no tour <ArrowRight className="size-4" />
              </Button>
            </a>
            <Button size="lg" variant="outline" render={<Link href="/login" />}>
              Já tenho conta
            </Button>
          </div>
        </div>
      </header>

      {/* REPERTÓRIO */}
      <div id="repertorio" />
      <Section icon={Music2} kicker="Repertório" title="Todas as músicas — busque e filtre na hora">
        <p className="mb-4 text-sm text-muted-foreground">
          Status de cada música (pronta, precisa ensaiar, aprendendo), tom, duração e letra.
          <strong className="text-foreground"> Digite na busca</strong> ou toque nos filtros pra ver acontecer.
        </p>
        <RepertorioDemo />
      </Section>

      {/* SETLIST + TELEPROMPTER */}
      <Section icon={ListMusic} kicker="Setlist & Teleprompter" title="Monte o show e suba no palco com confiança">
        <p className="mb-4 text-sm text-muted-foreground">
          Arraste pra ordenar, marque emendas e afinações dropadas, e abra o
          <strong className="text-foreground"> teleprompter</strong>: letras gigantes que rolam sozinhas. No modo
          <strong className="text-foreground"> Sync</strong>, a letra acompanha a música no tempo certo — como o Spotify.
        </p>
        <SetlistDemo />
      </Section>

      {/* AGENDA */}
      <Section icon={CalendarDays} kicker="Agenda" title="Shows e ensaios com confirmação de presença">
        <p className="mb-4 text-sm text-muted-foreground">
          Cada evento avisa a banda automaticamente e cobra quem ainda não confirmou.
          Você vê na hora quem vai e quem falta.
        </p>
        <AgendaDemo />
      </Section>

      {/* DIVULGAÇÃO */}
      <Section icon={Megaphone} kicker="Divulgação" title="Flyer pronto pra postar em segundos">
        <p className="mb-4 text-sm text-muted-foreground">
          O StageBoss gera o flyer do show com a sua identidade — escolha o modelo, baixe e poste.
        </p>
        <FlyerDemo />
      </Section>

      {/* E TEM MUITO MAIS */}
      <Section icon={Sparkles} kicker="E tem muito mais" title="Os bastidores que fazem a banda rodar redonda">
        <MaisGrid />
      </Section>

      {/* CTA FINAL */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6">
        <Card className="bg-linear-to-br from-primary/15 to-background p-8 text-center ring-1 ring-primary/20">
          <Sparkles className="mx-auto mb-3 size-8 text-primary" />
          <h2 className="text-2xl font-bold sm:text-3xl">Curtiu? Leve o StageBoss pra sua banda.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Tudo o que você mexeu aqui funcionando, com os dados da <strong className="text-foreground">sua</strong> banda — e só a sua banda vê.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" render={<Link href="/login" />}>
              Começar agora <ArrowRight className="size-4" />
            </Button>
            <a href="#repertorio">
              <Button size="lg" variant="outline">Ver o tour de novo</Button>
            </a>
          </div>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">StageBoss · feito por músicos, pra músicos.</p>
      </section>
    </div>
  );
}
