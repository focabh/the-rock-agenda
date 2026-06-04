"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Play, Pause, Minus, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setSongBpmAction } from "@/app/(app)/repertorio/actions";

/** Botão compacto de metrônomo por música (repertório/setlist). Toca no BPM
 *  da música; dá pra ajustar e salvar. Web Audio, sem custo. */
export function MetronomeButton({ bpm: bpmInicial, titulo, songId }: { bpm: number | null; titulo: string; songId?: string }) {
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = useState(bpmInicial && bpmInicial > 0 ? bpmInicial : 100);
  const [tocando, setTocando] = useState(false);
  const [beat, setBeat] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const bpmRef = useRef(bpm);
  const tapsRef = useRef<number[]>([]);
  bpmRef.current = bpm;

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
    while (nextRef.current < ctx.currentTime + 0.1) {
      const pos = beatRef.current % 4;
      click(nextRef.current, pos === 0);
      setBeat(pos);
      nextRef.current += 60 / bpmRef.current;
      beatRef.current = (beatRef.current + 1) % 4;
    }
    timerRef.current = window.setTimeout(scheduler, 25);
  }
  function start() {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    ctxRef.current = ctx;
    beatRef.current = 0;
    nextRef.current = ctx.currentTime + 0.05;
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
  function setBpmClamp(v: number) {
    setBpm(Math.max(30, Math.min(300, Math.round(v))));
  }
  function tap() {
    const now = performance.now();
    const taps = tapsRef.current.filter((t) => now - t < 2000);
    taps.push(now);
    tapsRef.current = taps;
    if (taps.length >= 2) {
      const ints = taps.slice(1).map((t, i) => t - taps[i]);
      setBpmClamp(60000 / (ints.reduce((a, b) => a + b, 0) / ints.length));
    }
  }
  function salvar() {
    if (!songId) return;
    setSalvando(true);
    setSongBpmAction(songId, bpm)
      .then(() => toast.success(`BPM ${bpm} salvo em "${titulo}".`))
      .catch(() => toast.error("Não consegui salvar."))
      .finally(() => setSalvando(false));
  }

  // Fecha o áudio ao fechar o diálogo / desmontar.
  useEffect(() => {
    if (!open && tocando) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => () => stop(), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-1.5 text-violet-300 transition-colors hover:bg-violet-500/15"
        title={bpmInicial ? `Metrônomo · ${bpmInicial} BPM` : "Metrônomo (defina o BPM)"}
      >
        <Activity className="size-3.5" />
        {bpmInicial ? <span className="font-mono text-[10px]">{bpmInicial}</span> : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Metrônomo · {titulo}</DialogTitle>
            <DialogDescription>{bpmInicial ? `BPM salvo: ${bpmInicial}` : "Sem BPM salvo — use o Tap e salve."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div className="font-mono text-5xl font-black">{bpm}</div>
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("size-3 rounded-full transition-colors", tocando && beat === i ? (i === 0 ? "bg-primary" : "bg-amber-400") : "bg-muted")} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setBpmClamp(bpm - 1)}><Minus className="size-4" /></Button>
              <input type="range" min={30} max={300} value={bpm} onChange={(e) => setBpmClamp(Number(e.target.value))} className="h-2 flex-1 cursor-pointer accent-primary" />
              <Button variant="outline" size="icon" onClick={() => setBpmClamp(bpm + 1)}><Plus className="size-4" /></Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => (tocando ? stop() : start())} className={cn("min-w-28", tocando && "bg-red-600 hover:bg-red-700")}>
                {tocando ? <Pause className="size-4" /> : <Play className="size-4" />}
                {tocando ? "Parar" : "Iniciar"}
              </Button>
              <Button variant="outline" onClick={tap}>Tap tempo</Button>
              {songId && (
                <Button variant="outline" onClick={salvar} disabled={salvando}>
                  <Save className="size-4" /> Salvar {bpm}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
