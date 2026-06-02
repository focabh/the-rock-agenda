"use client";

import Link from "next/link";
import {
  Music2,
  CalendarDays,
  ListMusic,
  Sparkles,
  Guitar,
  Play,
  MapPin,
  Star,
  ArrowRight,
  Flame,
  Megaphone,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SongStatusBadge } from "@/components/shared/status-badge";
import { Teleprompter } from "@/components/shared/teleprompter";
import { cn } from "@/lib/utils";

/* =========================================================================
   DADOS 100% FICTÍCIOS — banda inventada "Os Aventureiros".
   Nada aqui toca no banco real. É só um gostinho do que o StageBoss faz.
   ========================================================================= */

const BANDA = "Os Aventureiros";

type DemoSong = {
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  status: "pronta" | "precisa_ensaiar" | "aprendendo";
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
      "Acende a noite, vem comigo\nO céu inteiro é nosso abrigo\nCorre na estrada sem temer\nO trovão de verão vai te trazer\n\nPisa no acelerador\nDeixa pra trás todo o temor\nA gente brilha quando escurece\n^E o mundo inteiro estremece^",
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

const SETLIST = [
  { n: 1, titulo: "Cidade de Neon", tom: "G", dur: "4:05", emenda: true },
  { n: 2, titulo: "Trovão de Verão", tom: "Am", dur: "3:42", drop: false },
  { n: 3, titulo: "Coração de Aço", tom: "E", dur: "3:55", drop: true },
  { n: 4, titulo: "Estrada Sem Fim", tom: "D", dur: "3:18" },
  { n: 5, titulo: "Last Call", tom: "C", dur: "2:58" },
];

const AGENDA = [
  { dia: "12", mes: "JUN", titulo: "Bar do Rock", cidade: "São Paulo · SP", tipo: "Show", status: "Confirmado", confirmados: "5/5" },
  { dia: "19", mes: "JUN", titulo: "Ensaio geral", cidade: "Estúdio Garagem", tipo: "Ensaio", status: "Confirmado", confirmados: "4/5" },
  { dia: "28", mes: "JUN", titulo: "Festival de Inverno", cidade: "Campos do Jordão · SP", tipo: "Show", status: "Planejado", confirmados: "3/5" },
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

export function DemoTour() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Banner fixo: deixa claro que é demonstração */}
      <div className="sticky top-0 z-30 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-300 backdrop-blur">
        ✨ MODO DEMONSTRAÇÃO — dados fictícios da banda “{BANDA}”. Nada aqui é real.
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
            Role pra baixo e <strong className="text-foreground">experimente de verdade</strong> — inclusive o teleprompter sincronizado. 👇
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
      <Section icon={Music2} kicker="Repertório" title="Todas as músicas, do jeito que a banda precisa">
        <p className="mb-4 text-sm text-muted-foreground">
          Status de cada música (pronta, precisa ensaiar, aprendendo), tom, duração,
          letra, cifra e player do Spotify — tudo num lugar só.
        </p>
        <Card className="divide-y divide-border overflow-hidden p-0">
          {SONGS.map((s) => (
            <div key={s.n} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 text-right font-mono text-sm text-muted-foreground">{s.n}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{s.artista}</p>
              </div>
              <SongStatusBadge status={s.status} />
              {s.tom && <span className="hidden w-8 text-center font-mono text-xs text-muted-foreground sm:inline">{s.tom}</span>}
              <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">{s.dur}</span>
              <span className="inline-flex size-7 items-center justify-center rounded-full text-primary" title="Tocar (demo)">
                <Play className="size-3.5 fill-current" />
              </span>
              <span className="inline-flex size-7 items-center justify-center rounded-full text-orange-400" title="Cifra (demo)">
                <Guitar className="size-3.5" />
              </span>
            </div>
          ))}
        </Card>
      </Section>

      {/* SETLIST + TELEPROMPTER (interativo de verdade) */}
      <Section icon={ListMusic} kicker="Setlist & Teleprompter" title="Monte o show e suba no palco com confiança">
        <p className="mb-4 text-sm text-muted-foreground">
          Arraste pra ordenar, marque emendas e afinações dropadas, e abra o
          <strong className="text-foreground"> teleprompter</strong>: letras gigantes que rolam sozinhas.
          Toque em <strong className="text-foreground">Sync</strong> e veja a letra acompanhar a música no tempo certo — como o Spotify.
        </p>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-border">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="size-4 text-muted-foreground" />
            <span className="font-semibold">Bar do Rock</span>
            <span className="text-muted-foreground">· 12/jun · São Paulo</span>
          </div>
          <Teleprompter songs={SONGS.filter((s) => s.syncedLyrics).concat(SONGS.filter((s) => !s.syncedLyrics))} label="Teleprompter" />
        </div>
        <Card className="divide-y divide-border overflow-hidden p-0">
          {SETLIST.map((it) => (
            <div key={it.n} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 text-right font-mono text-sm text-muted-foreground">{it.n}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{it.titulo}</p>
              </div>
              {it.drop && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-inset ring-amber-500/30">DROP</span>}
              {it.emenda && <span className="text-xs text-primary" title="Emenda na próxima">↘ emenda</span>}
              <span className="w-8 text-center font-mono text-xs text-muted-foreground">{it.tom}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{it.dur}</span>
            </div>
          ))}
        </Card>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          👆 Toque em <strong>Teleprompter</strong> acima e depois no botão <strong>Sync</strong> — funciona ao vivo.
        </p>
      </Section>

      {/* AGENDA */}
      <Section icon={CalendarDays} kicker="Agenda" title="Shows e ensaios com confirmação de presença">
        <p className="mb-4 text-sm text-muted-foreground">
          Cada evento avisa a banda automaticamente e cobra quem ainda não confirmou.
          Você vê na hora quem vai e quem falta.
        </p>
        <div className="space-y-2">
          {AGENDA.map((e, i) => (
            <Card key={i} className="flex items-center gap-4 p-3">
              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <span className="text-lg font-black leading-none">{e.dia}</span>
                <span className="text-[10px] font-bold uppercase text-primary">{e.mes}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{e.tipo} · {e.cidade}</p>
              </div>
              <div className="text-right">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", e.status === "Confirmado" ? "bg-emerald-500/15 text-emerald-300" : "bg-blue-500/15 text-blue-300")}>
                  {e.status === "Confirmado" && <CheckCircle2 className="size-3" />}
                  {e.status}
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <Star className="mr-0.5 inline size-3 fill-amber-400 text-amber-400" />
                  {e.confirmados} confirmados
                </p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* DIVULGAÇÃO */}
      <Section icon={Megaphone} kicker="Divulgação" title="Flyer pronto pra postar em segundos">
        <p className="mb-4 text-sm text-muted-foreground">
          O StageBoss gera o flyer do show com a sua identidade — escolha o modelo, baixe e poste.
        </p>
        <div className="mx-auto aspect-4/5 w-full max-w-xs overflow-hidden rounded-2xl bg-linear-to-br from-primary/30 via-background to-amber-500/20 p-6 text-center ring-1 ring-border">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">Ao vivo</p>
              <h3 className="mt-2 text-4xl font-black leading-none">{BANDA}</h3>
            </div>
            <div>
              <p className="text-5xl font-black text-primary">12 JUN</p>
              <p className="mt-1 text-sm font-semibold">Bar do Rock · São Paulo</p>
            </div>
            <p className="text-xs text-muted-foreground">22h · Entrada solidária</p>
          </div>
        </div>
      </Section>

      {/* CTA FINAL */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6">
        <Card className="bg-linear-to-br from-primary/15 to-background p-8 text-center ring-1 ring-primary/20">
          <Sparkles className="mx-auto mb-3 size-8 text-primary" />
          <h2 className="text-2xl font-bold sm:text-3xl">Curtiu? Leve o StageBoss pra sua banda.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Tudo o que você viu aqui funcionando, com os dados da <strong className="text-foreground">sua</strong> banda — e só a sua banda vê.
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
