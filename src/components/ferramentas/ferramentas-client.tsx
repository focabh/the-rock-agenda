"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Play, Pause, Minus, Plus, Guitar, Music4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
function Metronomo() {
  const [bpm, setBpm] = useState(100);
  const [tocando, setTocando] = useState(false);
  const [compasso, setCompasso] = useState(4);
  const [beat, setBeat] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextNoteRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const bpmRef = useRef(bpm);
  const compRef = useRef(compasso);
  const tapsRef = useRef<number[]>([]);
  bpmRef.current = bpm;
  compRef.current = compasso;

  function click(time: number, acento: boolean) {
    const ctx = ctxRef.current!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = acento ? 1500 : 900;
    g.gain.setValueAtTime(acento ? 0.5 : 0.32, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  function scheduler() {
    const ctx = ctxRef.current!;
    while (nextNoteRef.current < ctx.currentTime + 0.1) {
      const acento = beatRef.current % compRef.current === 0;
      click(nextNoteRef.current, acento);
      const b = beatRef.current % compRef.current;
      setBeat(b);
      nextNoteRef.current += 60 / bpmRef.current;
      beatRef.current = (beatRef.current + 1) % compRef.current;
    }
    timerRef.current = window.setTimeout(scheduler, 25);
  }

  function start() {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    ctxRef.current = ctx;
    beatRef.current = 0;
    nextNoteRef.current = ctx.currentTime + 0.05;
    setTocando(true);
    scheduler();
  }
  function stop() {
    setTocando(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setBeat(0);
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

  useEffect(() => () => stop(), []);

  return (
    <div className="space-y-5 text-center">
      <Card className="py-8">
        <div className="font-mono text-6xl font-black">{bpm}</div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">BPM</p>

        {/* pulsos do compasso */}
        <div className="mt-5 flex justify-center gap-2">
          {Array.from({ length: compasso }, (_, i) => (
            <span
              key={i}
              className={cn(
                "size-3 rounded-full transition-colors",
                tocando && beat === i ? (i === 0 ? "bg-primary" : "bg-amber-400") : "bg-muted"
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
        <div className="inline-flex overflow-hidden rounded-full ring-1 ring-border">
          {[3, 4, 6].map((c) => (
            <button key={c} onClick={() => setCompasso(c)} className={cn("px-3 py-1.5 text-sm font-semibold", compasso === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {c}/4
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Toque "Tap tempo" no ritmo da música pra achar o BPM.</p>
    </div>
  );
}

/* ---------------- WRAPPER ---------------- */
export function FerramentasClient() {
  const [aba, setAba] = useState<"afinador" | "metronomo">("afinador");
  return (
    <div className="mx-auto max-w-md p-4 sm:p-6">
      <div className="mb-5 inline-flex w-full overflow-hidden rounded-xl ring-1 ring-border">
        <button onClick={() => setAba("afinador")} className={cn("flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold", aba === "afinador" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
          <Guitar className="size-4" /> Afinador
        </button>
        <button onClick={() => setAba("metronomo")} className={cn("flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold", aba === "metronomo" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
          <Music4 className="size-4" /> Metrônomo
        </button>
      </div>
      {aba === "afinador" ? <Afinador /> : <Metronomo />}
    </div>
  );
}
