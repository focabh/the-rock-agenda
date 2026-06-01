"use client";

import { useEffect, useRef, useState } from "react";
import { MonitorPlay, Play, Pause, X, Minus, Plus, Gauge, Type } from "lucide-react";
import { Button } from "@/components/ui/button";

type Song = { n: number; titulo: string; artista: string; tom: string | null; lyrics: string | null };

/** Teleprompter pro vocalista: tela cheia, letras grandes rolando sozinhas.
 *  Toque na tela = play/pause. Velocidade e fonte ajustáveis. Mantém a tela
 *  acesa (Wake Lock) enquanto rola. */
export function Teleprompter({ songs }: { songs: Song[] }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(45); // px/s
  const [fontIdx, setFontIdx] = useState(2);
  const scrollRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | undefined>(undefined);
  const last = useRef(0);

  const FONTS = ["text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl"];

  // Loop de rolagem automática.
  useEffect(() => {
    if (!open || !playing) return;
    let active = true;
    last.current = 0;
    const step = (ts: number) => {
      if (!active) return;
      if (last.current) {
        const el = scrollRef.current;
        if (el) {
          el.scrollTop += (speed * (ts - last.current)) / 1000;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
            setPlaying(false);
            active = false;
            return;
          }
        }
      }
      last.current = ts;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      active = false;
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [open, playing, speed]);

  // Mantém a tela acesa enquanto está aberto.
  useEffect(() => {
    if (!open) return;
    let lock: { release?: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* sem suporte — tudo bem */
      }
    };
    req();
    const onVis = () => {
      if (document.visibilityState === "visible") req();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, [open]);

  // Reseta ao abrir.
  useEffect(() => {
    if (open) {
      setPlaying(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [open]);

  return (
    <>
      <Button
        size="sm"
        className="bg-zinc-900 text-white hover:bg-zinc-800"
        onClick={() => setOpen(true)}
        title="Teleprompter: letras grandes rolando sozinhas, pro vocalista"
      >
        <MonitorPlay className="size-4" />
        Teleprompter
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
          {/* Área das letras — toque alterna play/pause */}
          <div
            ref={scrollRef}
            onClick={() => setPlaying((p) => !p)}
            className="flex-1 overflow-y-auto px-6 text-center"
          >
            <div className="h-[40vh]" aria-hidden />
            {songs.length === 0 ? (
              <p className="text-2xl text-white/60">Setlist vazia.</p>
            ) : (
              songs.map((s) => (
                <section key={s.n} className="mb-16">
                  <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-amber-400">
                    {s.n}. {s.titulo}
                    {s.tom ? ` · ${s.tom}` : ""}
                  </h2>
                  {s.lyrics?.trim() ? (
                    <pre className={`whitespace-pre-wrap font-sans font-semibold leading-relaxed ${FONTS[fontIdx]}`}>
                      {s.lyrics}
                    </pre>
                  ) : (
                    <p className="text-xl italic text-white/50">Letra não disponível.</p>
                  )}
                </section>
              ))
            )}
            <div className="h-[60vh]" aria-hidden />
          </div>

          {/* Controles — fixos embaixo */}
          <div className="flex items-center justify-center gap-2 border-t border-white/15 bg-black/90 px-3 py-2 backdrop-blur">
            <button
              onClick={() => setFontIdx((i) => Math.max(0, i - 1))}
              disabled={fontIdx === 0}
              className="inline-flex size-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-40"
              title="Fonte menor"
            >
              <Type className="size-4" />
              <Minus className="size-3" />
            </button>
            <button
              onClick={() => setFontIdx((i) => Math.min(FONTS.length - 1, i + 1))}
              disabled={fontIdx === FONTS.length - 1}
              className="inline-flex size-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-40"
              title="Fonte maior"
            >
              <Type className="size-5" />
              <Plus className="size-3" />
            </button>

            <button
              onClick={() => setSpeed((v) => Math.max(15, v - 10))}
              className="inline-flex size-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
              title="Mais devagar"
            >
              <Gauge className="size-4" />
              <Minus className="size-3" />
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90"
              title={playing ? "Pausar" : "Começar"}
            >
              {playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current" />}
            </button>
            <button
              onClick={() => setSpeed((v) => Math.min(150, v + 10))}
              className="inline-flex size-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
              title="Mais rápido"
            >
              <Gauge className="size-4" />
              <Plus className="size-3" />
            </button>

            <button
              onClick={() => {
                setPlaying(false);
                setOpen(false);
              }}
              className="ml-1 inline-flex size-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
              title="Fechar"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="bg-black pb-[env(safe-area-inset-bottom)] text-center text-[11px] text-white/40">
            Toque na letra pra pausar/continuar · {speed} px/s
          </div>
        </div>
      )}
    </>
  );
}
