"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Play, Pause, Minus, Plus, Guitar, Search, Save, Volume2, VolumeX, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MetronomeIcon } from "@/components/shared/metronome-icon";
import { toast } from "sonner";
import { prepareAudioContext } from "@/lib/audio-unlock";
import { setSongBpmAction } from "@/app/(app)/repertorio/actions";

export type SongTempo = { id: string; titulo: string; artista: string; tom: string | null; bpm: number | null; obs: string | null };

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function freqToNote(freq: number) {
  const n = 12 * Math.log2(freq / 440);
  const midi = Math.round(n) + 69;
  const cents = Math.round((n - Math.round(n)) * 100);
  return { name: NOTES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1, cents };
}

/** Autocorrelação (detecção de pitch) — clássico do PitchDetect, client-side. */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // baixo demais
  let r1 = 0,
    r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  const b = buf.slice(r1, r2);
  const n = b.length;
  const c = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) c[i] += b[j] * b[j + i];
  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let max = -1,
    pos = -1;
  for (let i = d; i < n; i++) if (c[i] > max) { max = c[i]; pos = i; }
  let T0 = pos;
  const x1 = c[T0 - 1] ?? 0,
    x2 = c[T0],
    x3 = c[T0 + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);
  return sampleRate / T0;
}

/* ---------------- AFINADOR ---------------- */
function Afinador() {
  const [ativo, setAtivo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<{ name: string; octave: number; cents: number; freq: number } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  async function ligar() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      setAtivo(true);
      const loop = () => {
        analyser.getFloatTimeDomainData(buf);
        const freq = autoCorrelate(buf, ctx.sampleRate);
        if (freq > 0) setNota({ ...freqToNote(freq), freq });
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      setErro("Não consegui acessar o microfone. Permita o acesso e tente de novo.");
    }
  }

  function desligar() {
    setAtivo(false);
    setNota(null);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    streamRef.current = null;
    ctxRef.current = null;
  }

  useEffect(() => () => desligar(), []);

  const cents = nota?.cents ?? 0;
  const afinado = nota != null && Math.abs(cents) <= 5;

  return (
    <div className="space-y-5 text-center">
      <p className="text-sm text-muted-foreground">Toque uma corda/nota. Verde = afinado; ←/→ indica baixar/subir.</p>

      <Card className="py-8">
        <div className={cn("font-mono text-6xl font-black transition-colors", !nota ? "text-muted-foreground/40" : afinado ? "text-emerald-400" : "text-amber-400")}>
          {nota ? nota.name : "—"}
          {nota && <span className="align-top text-2xl text-muted-foreground">{nota.octave}</span>}
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {nota ? `${nota.freq.toFixed(1)} Hz · ${cents > 0 ? "+" : ""}${cents} cents` : "aguardando som…"}
        </p>

        {/* Agulha de cents */}
        <div className="relative mx-auto mt-6 h-3 w-64 max-w-full rounded-full bg-muted">
          <div className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground/50" />
          {nota && (
            <div
              className={cn("absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-all", afinado ? "bg-emerald-400" : "bg-amber-400")}
              style={{ left: `calc(50% + ${Math.max(-50, Math.min(50, cents)) * 1.2}px - 8px)` }}
            />
          )}
        </div>
        <div className="mx-auto mt-1 flex w-64 max-w-full justify-between text-[10px] text-muted-foreground">
          <span>♭ baixo</span>
          <span>afinado</span>
          <span>alto ♯</span>
        </div>
      </Card>

      {erro && <p className="text-sm text-amber-300">{erro}</p>}

      {ativo ? (
        <Button variant="outline" onClick={desligar} className="w-full">
          <Pause className="size-4" /> Parar afinador
        </Button>
      ) : (
        <Button onClick={ligar} className="w-full">
          <Mic className="size-4" /> Ligar afinador (usa o microfone)
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground">
        Afinação padrão de guitarra/violão: E A D G B E · baixo: E A D G. O áudio não sai do seu aparelho.
      </p>
    </div>
  );
}

/* ---------------- METRÔNOMO ---------------- */
type Sig = { id: string; label: string; beats: number; accents: number[] };
const SIGS: Sig[] = [
  { id: "4/4", label: "4/4", beats: 4, accents: [0] },
  { id: "3/4", label: "3/4", beats: 3, accents: [0] },
  { id: "6/8", label: "6/8", beats: 6, accents: [0, 3] },
];

function Metronomo({ songs }: { songs: SongTempo[] }) {
  const [bpm, setBpm] = useState(100);
  const [tocando, setTocando] = useState(false);
  const [sigId, setSigId] = useState("4/4");
  const [beat, setBeat] = useState(0);
  const [vol, setVol] = useState(0.8);
  const [mudo, setMudo] = useState(false);
  // Modo visual (tela cheia): a tela pisca no tempo — pra batera de in-ear.
  const [visual, setVisual] = useState(false);
  const [flash, setFlash] = useState<{ on: boolean; acc: boolean }>({ on: false, acc: false });
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [lista, setLista] = useState(songs);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextNoteRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const bpmRef = useRef(bpm);
  const sigRef = useRef<Sig>(SIGS[0]);
  const volRef = useRef(vol);
  const mudoRef = useRef(mudo);
  const runningRef = useRef(false);
  const tapsRef = useRef<number[]>([]);
  bpmRef.current = bpm;
  mudoRef.current = mudo;
  const sig = SIGS.find((s) => s.id === sigId) ?? SIGS[0];
  sigRef.current = sig;
  volRef.current = vol;
  const sel = lista.find((s) => s.id === selId) ?? null;
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista
      .filter((s) => !t || s.titulo.toLowerCase().includes(t) || s.artista.toLowerCase().includes(t))
      .slice(0, 30);
  }, [lista, busca]);

  function click(time: number, acento: boolean) {
    const ctx = ctxRef.current!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = acento ? 1500 : 900;
    const v = mudoRef.current ? 0 : volRef.current; // mudo = só visual
    const peak = Math.max(0.0001, (acento ? 0.5 : 0.32) * v);
    g.gain.setValueAtTime(peak, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  function scheduler() {
    const ctx = ctxRef.current!;
    while (nextNoteRef.current < ctx.currentTime + 0.1) {
      const beats = sigRef.current.beats;
      const pos = beatRef.current % beats;
      const acc = sigRef.current.accents.includes(pos);
      const t = nextNoteRef.current;
      click(t, acc);
      // Agenda o flash/contagem pro INSTANTE do clique (preciso, não adiantado).
      const delay = Math.max(0, (t - ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (!runningRef.current) return;
        setBeat(pos);
        setFlash({ on: true, acc });
      }, delay);
      window.setTimeout(() => {
        if (!runningRef.current) return;
        setFlash((f) => ({ ...f, on: false }));
      }, delay + 90);
      nextNoteRef.current += 60 / bpmRef.current;
      beatRef.current = (beatRef.current + 1) % beats;
    }
    timerRef.current = window.setTimeout(scheduler, 25);
  }

  async function start() {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    ctxRef.current = ctx;
    runningRef.current = true;
    setTocando(true);
    await prepareAudioContext(ctx); // destrava no mobile (resume + iOS silencioso)
    if (ctxRef.current !== ctx) return; // parou enquanto destravava
    beatRef.current = 0;
    nextNoteRef.current = ctx.currentTime + 0.1;
    scheduler();
  }
  function stop() {
    runningRef.current = false;
    setTocando(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setBeat(0);
    setFlash({ on: false, acc: false });
  }
  function toggle() {
    if (tocando) stop();
    else start();
  }
  function setBpmClamp(v: number) {
    setBpm(Math.max(30, Math.min(300, Math.round(v))));
  }
  function tap() {
    const now = performance.now();
    const taps = tapsRef.current.filter((t) => now - t < 2000);
    taps.push(now);
    tapsRef.current = taps;
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpmClamp(60000 / avg);
    }
  }

  function escolher(s: SongTempo) {
    setSelId(s.id);
    if (s.bpm) setBpm(s.bpm);
  }
  function salvarBpm() {
    if (!sel) return;
    setSalvando(true);
    setSongBpmAction(sel.id, bpm)
      .then((r) => {
        setLista((p) => p.map((x) => (x.id === sel.id ? { ...x, bpm: r.bpm } : x)));
        toast.success(`BPM ${bpm} salvo em "${sel.titulo}".`);
      })
      .catch(() => toast.error("Não consegui salvar o BPM."))
      .finally(() => setSalvando(false));
  }

  useEffect(() => () => stop(), []);

  // Tela visual ligada → mantém a tela acesa (não dorme no meio do ensaio).
  useEffect(() => {
    if (!visual) return;
    let lock: { release?: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* sem suporte */
      }
    };
    req();
    const onVis = () => document.visibilityState === "visible" && visual && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, [visual]);

  function enterVisual() {
    setVisual(true);
    if (!tocando) start();
    try {
      document.documentElement.requestFullscreen?.();
    } catch {
      /* ignore */
    }
  }
  function exitVisual() {
    setVisual(false);
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5 text-center">
      <Card className="py-8">
        <div className="font-mono text-6xl font-black">{bpm}</div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">BPM{sel ? ` · ${sel.titulo}` : ""}</p>

        {/* pulsos do compasso */}
        <div className="mt-5 flex justify-center gap-2">
          {Array.from({ length: sig.beats }, (_, i) => (
            <span
              key={i}
              className={cn(
                "size-3 rounded-full transition-colors",
                tocando && beat === i ? (sig.accents.includes(i) ? "bg-primary" : "bg-amber-400") : sig.accents.includes(i) ? "bg-muted-foreground/40" : "bg-muted"
              )}
            />
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setBpmClamp(bpm - 1)}><Minus className="size-4" /></Button>
        <input type="range" min={30} max={300} value={bpm} onChange={(e) => setBpmClamp(Number(e.target.value))} className="h-2 flex-1 max-w-xs cursor-pointer accent-primary" />
        <Button variant="outline" size="icon" onClick={() => setBpmClamp(bpm + 1)}><Plus className="size-4" /></Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={toggle} className={cn("min-w-32", tocando && "bg-red-600 hover:bg-red-700")}>
          {tocando ? <Pause className="size-4" /> : <Play className="size-4" />}
          {tocando ? "Parar" : "Iniciar"}
        </Button>
        <Button variant="outline" onClick={tap}>Tap tempo</Button>
        <Button variant="outline" onClick={enterVisual} title="Metrônomo visual em tela cheia (pra in-ear)">
          <Maximize2 className="size-4" /> Visual
        </Button>
        <div className="inline-flex overflow-hidden rounded-full ring-1 ring-border">
          {SIGS.map((s) => (
            <button key={s.id} onClick={() => setSigId(s.id)} className={cn("px-3 py-1.5 text-sm font-semibold", sigId === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-center gap-3">
        <Volume2 className="size-4 text-muted-foreground" />
        <input type="range" min={0} max={100} value={Math.round(vol * 100)} onChange={(e) => setVol(Number(e.target.value) / 100)} className="h-2 flex-1 max-w-xs cursor-pointer accent-primary" aria-label="Volume" />
        <span className="w-8 text-right font-mono text-xs text-muted-foreground">{Math.round(vol * 100)}</span>
      </div>

      {/* Integração com o repertório: carregar/salvar BPM por música */}
      <div className="space-y-2 rounded-xl border border-border p-3 text-left">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Música do repertório (carrega o BPM salvo)…" className="pl-8" />
        </div>
        {sel && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{sel.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">
                {sel.tom ? `tom ${sel.tom}` : "sem tom"}
                {sel.bpm ? ` · BPM salvo ${sel.bpm}` : " · sem BPM"}
                {sel.obs ? ` · ${sel.obs}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={salvarBpm} disabled={salvando}>
              <Save className="size-4" /> Salvar BPM {bpm}
            </Button>
          </div>
        )}
        {busca.trim() && (
          <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg bg-card">
            {filtradas.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</li>
            ) : (
              filtradas.map((s) => (
                <li key={s.id}>
                  <button onClick={() => escolher(s)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40">
                    <span className="min-w-0 truncate">
                      {s.titulo}
                      <span className="text-muted-foreground"> · {s.artista}</span>
                    </span>
                    {s.bpm ? <span className="shrink-0 font-mono text-xs text-amber-300">{s.bpm} BPM</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">Toque "Tap tempo" no ritmo da música; busque uma música pra carregar/salvar o BPM dela. <strong className="text-foreground">Visual</strong> abre o metrônomo em tela cheia (pra in-ear).</p>

      {/* Metrônomo VISUAL em tela cheia — a tela pisca no tempo (tempo 1 em âmbar). */}
      {visual && (
        <div
          className="fixed inset-0 z-100 flex select-none flex-col items-center justify-center transition-colors duration-75"
          style={{ backgroundColor: flash.on ? (flash.acc ? "#f59e0b" : "#e4e4e7") : "#09090b" }}
          onClick={() => (tocando ? stop() : start())}
        >
          <div className="pointer-events-none text-center leading-none">
            <div
              className={cn("font-mono font-black tabular-nums", flash.on ? "text-zinc-950" : "text-zinc-100")}
              style={{ fontSize: "40vmin", lineHeight: 1 }}
            >
              {tocando ? beat + 1 : "•"}
            </div>
            <p className={cn("mt-3 text-xl font-semibold", flash.on ? "text-zinc-900" : "text-zinc-400")}>
              {bpm} BPM · {sig.label}{mudo ? " · mudo" : ""}
            </p>
            <p className={cn("mt-1 text-sm", flash.on ? "text-zinc-800/80" : "text-zinc-500")}>
              {tocando ? "toque na tela pra parar" : "toque na tela pra iniciar"}
            </p>
          </div>

          <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-wrap items-center justify-center gap-2 px-4">
            <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); setBpmClamp(bpm - 1); }}><Minus className="size-4" /></Button>
            <Button onClick={(e) => { e.stopPropagation(); toggle(); }} className={cn("min-w-28", tocando && "bg-red-600 hover:bg-red-700")}>
              {tocando ? <Pause className="size-4" /> : <Play className="size-4" />}
              {tocando ? "Parar" : "Iniciar"}
            </Button>
            <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); setBpmClamp(bpm + 1); }}><Plus className="size-4" /></Button>
            <Button variant="outline" onClick={(e) => { e.stopPropagation(); setMudo((m) => !m); }}>
              {mudo ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              {mudo ? "Mudo" : "Som"}
            </Button>
            <Button variant="outline" onClick={(e) => { e.stopPropagation(); exitVisual(); }}>
              <X className="size-4" /> Sair
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- WRAPPER ---------------- */
export function FerramentasClient({ songs = [] }: { songs?: SongTempo[] }) {
  const [aba, setAba] = useState<"afinador" | "metronomo">("afinador");
  return (
    <div className="mx-auto max-w-md p-4 sm:p-6">
      <div className="mb-5 inline-flex w-full overflow-hidden rounded-xl ring-1 ring-border">
        <button onClick={() => setAba("afinador")} className={cn("flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold", aba === "afinador" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
          <Guitar className="size-4" /> Afinador
        </button>
        <button onClick={() => setAba("metronomo")} className={cn("flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold", aba === "metronomo" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
          <MetronomeIcon className="size-4" /> Metrônomo
        </button>
      </div>
      {aba === "afinador" ? <Afinador /> : <Metronomo songs={songs} />}
    </div>
  );
}
