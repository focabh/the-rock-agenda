"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MonitorPlay,
  Play,
  Pause,
  X,
  Minus,
  Plus,
  SkipBack,
  SkipForward,
  Maximize,
  Minimize,
  ListMusic,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LyricsText } from "@/components/shared/lyrics-text";

type Song = { n: number; titulo: string; artista: string; tom: string | null; lyrics: string | null };

// Tamanhos responsivos: já começam grandes no celular.
const FONTS = [
  "text-3xl sm:text-4xl",
  "text-4xl sm:text-5xl",
  "text-5xl sm:text-6xl",
  "text-6xl sm:text-7xl",
  "text-7xl sm:text-8xl",
  "text-8xl sm:text-9xl",
];
const SPEED_KEY = "teleprompter-speeds-v1";
const DEFAULT_SPEED = 24; // px/s — bem mais lento por padrão
const MIN_SPEED = 3;
const MAX_SPEED = 90;

const songKey = (s: Song) => `${s.titulo}__${s.artista}`.toLowerCase();

/** Teleprompter do vocalista: letras GRANDES rolando sozinhas, em tela cheia.
 *  Controles estilo player (auto-some), pular faixa, velocidade fina, e memória
 *  de velocidade por música. Destaque de grito (^...^) vindo da própria letra. */
export function Teleprompter({ songs, label = "Teleprompter" }: { songs: Song[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [fontIdx, setFontIdx] = useState(3);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<"full" | "half">("full");
  const [showControls, setShowControls] = useState(true);
  const [showList, setShowList] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const raf = useRef<number | undefined>(undefined);
  const last = useRef(0);
  const playingRef = useRef(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const speeds = useRef<Record<string, number>>({});
  const scrollTick = useRef(false);

  playingRef.current = playing;

  // Carrega memória de velocidade por música.
  useEffect(() => {
    try {
      speeds.current = JSON.parse(localStorage.getItem(SPEED_KEY) || "{}");
    } catch {
      speeds.current = {};
    }
  }, []);

  // Loop de rolagem.
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

  // Mantém a tela acesa.
  useEffect(() => {
    if (!open) return;
    let lock: { release?: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* sem suporte */
      }
    };
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, [open]);

  // Se sair da tela cheia real (Esc) estando em "full", volta pra metade.
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setMode((m) => (m === "full" ? "half" : m));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Abre em tela cheia (overlay cobre tudo). NÃO pede fullscreen do navegador
  // aqui (no celular é rejeitado e jogava pro modo metade). O botão de
  // maximizar pede o fullscreen real quando o usuário quiser (desktop/Android).
  useEffect(() => {
    if (open) {
      setPlaying(false);
      setCurrent(0);
      setMode("full");
      bumpControls();
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (playingRef.current && !showList) setShowControls(false);
    }, 3500);
  }, [showList]);

  // Detecta a música atual pela rolagem + aplica a velocidade memorizada dela.
  function onScroll() {
    if (scrollTick.current) return;
    scrollTick.current = true;
    requestAnimationFrame(() => {
      scrollTick.current = false;
      const el = scrollRef.current;
      if (!el) return;
      const y = el.scrollTop + el.clientHeight * 0.35;
      let idx = 0;
      for (let i = 0; i < sectionRefs.current.length; i++) {
        const sec = sectionRefs.current[i];
        if (sec && sec.offsetTop <= y) idx = i;
      }
      if (idx !== current) {
        setCurrent(idx);
        const saved = speeds.current[songKey(songs[idx])];
        if (saved) setSpeed(saved);
      }
    });
  }

  function changeSpeed(v: number) {
    const val = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(v)));
    setSpeed(val);
    const k = songs[current] ? songKey(songs[current]) : null;
    if (k) {
      speeds.current[k] = val;
      try {
        localStorage.setItem(SPEED_KEY, JSON.stringify(speeds.current));
      } catch {
        /* ignora */
      }
    }
  }

  function jumpTo(i: number) {
    const idx = Math.min(songs.length - 1, Math.max(0, i));
    const el = scrollRef.current;
    const sec = sectionRefs.current[idx];
    if (el && sec) el.scrollTop = sec.offsetTop - el.clientHeight * 0.25;
    setCurrent(idx);
    setShowList(false);
    bumpControls();
  }

  async function enterFull() {
    setMode("full");
    try {
      await rootRef.current?.requestFullscreen?.();
    } catch {
      /* iOS não permite em elementos — o overlay já ocupa tudo */
    }
  }

  async function goHalf() {
    setMode("half");
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }

  async function close() {
    setPlaying(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    setOpen(false);
  }

  const ctrlBtn =
    "inline-flex items-center justify-center rounded-full text-white/85 hover:bg-white/10 disabled:opacity-40";

  return (
    <>
      <Button
        size="sm"
        className="bg-zinc-900 text-white hover:bg-zinc-800"
        onClick={() => setOpen(true)}
        title="Teleprompter: letras grandes rolando sozinhas, pro vocalista"
      >
        <MonitorPlay className="size-4" />
        {label}
      </Button>

      {open && (
        <div
          ref={rootRef}
          className={`fixed z-50 flex flex-col bg-black text-white ${
            mode === "full"
              ? "inset-0"
              : "inset-x-0 bottom-0 h-[58vh] rounded-t-2xl border-t border-white/20 shadow-2xl"
          }`}
        >
          {/* Topo: música atual + sair (some junto com os controles) */}
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-linear-to-b from-black/80 to-transparent px-4 pb-6 pt-3 transition-opacity ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="pointer-events-auto truncate text-sm font-semibold text-amber-400">
              {songs[current] ? `${songs[current].n}. ${songs[current].titulo}` : ""}
              {songs[current]?.tom ? ` · ${songs[current].tom}` : ""}
            </span>
            <button
              onClick={close}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              title="Sair do teleprompter (voltar pras letras)"
            >
              <X className="size-4" /> Sair
            </button>
          </div>

          {/* Letras rolando — toque mostra/esconde controles */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            onPointerDown={() => (showControls ? setShowControls(false) : bumpControls())}
            className="flex-1 overflow-y-auto px-6 text-center"
          >
            <div className="h-[42vh]" aria-hidden />
            {songs.length === 0 ? (
              <p className="text-3xl text-white/60">Setlist vazia.</p>
            ) : (
              songs.map((s, i) => (
                <section
                  key={s.n}
                  ref={(el) => {
                    sectionRefs.current[i] = el;
                  }}
                  className="mb-20"
                >
                  <h2 className="mb-5 text-base font-bold uppercase tracking-[0.2em] text-amber-400/90">
                    {s.n}. {s.titulo}
                    {s.tom ? ` · ${s.tom}` : ""}
                  </h2>
                  {s.lyrics?.trim() ? (
                    <LyricsText
                      text={s.lyrics}
                      tone="dark"
                      className={`font-semibold leading-[1.4] ${FONTS[fontIdx]}`}
                    />
                  ) : (
                    <p className="text-2xl italic text-white/50">Letra não disponível.</p>
                  )}
                </section>
              ))
            )}
            <div className="h-[65vh]" aria-hidden />
          </div>

          {/* Lista de músicas (pular faixa) */}
          {showList && (
            <div className="absolute inset-0 z-20 flex flex-col bg-black/95 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">Pular pra…</span>
                <button onClick={() => setShowList(false)} className={`size-9 ${ctrlBtn}`}>
                  <X className="size-5" />
                </button>
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-white/10 overflow-y-auto">
                {songs.map((s, i) => (
                  <li key={s.n}>
                    <button
                      onClick={() => jumpTo(i)}
                      className={`flex w-full items-center gap-3 px-1 py-3 text-left ${i === current ? "text-amber-400" : "text-white/85"}`}
                    >
                      <span className="w-6 text-right font-mono text-white/40">{s.n}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{s.titulo}</span>
                      <span className="truncate text-sm text-white/40">{s.artista}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Controles (auto-some) */}
          <div
            className={`absolute inset-x-0 bottom-0 z-10 space-y-2 border-t border-white/10 bg-linear-to-t from-black via-black/90 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 transition-opacity ${
              showControls ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* Velocidade — slider fino */}
            <div className="flex items-center gap-3">
              <button onClick={() => changeSpeed(speed - 5)} className={`size-9 ${ctrlBtn}`} title="Mais devagar">
                <Minus className="size-5" />
              </button>
              <input
                type="range"
                min={MIN_SPEED}
                max={MAX_SPEED}
                step={1}
                value={speed}
                onChange={(e) => changeSpeed(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer accent-primary"
                aria-label="Velocidade"
              />
              <button onClick={() => changeSpeed(speed + 5)} className={`size-9 ${ctrlBtn}`} title="Mais rápido">
                <Plus className="size-5" />
              </button>
              <span className="w-16 text-right font-mono text-xs text-white/60">{speed} px/s</span>
            </div>

            {/* Linha de transporte */}
            <div className="flex items-center justify-center gap-1.5">
              <button onClick={() => setShowList(true)} className={`size-11 ${ctrlBtn}`} title="Lista de músicas">
                <ListMusic className="size-5" />
              </button>
              <button onClick={() => setFontIdx((i) => Math.max(0, i - 1))} disabled={fontIdx === 0} className={`size-11 ${ctrlBtn}`} title="Fonte menor">
                <Type className="size-4" />
              </button>
              <button onClick={() => setFontIdx((i) => Math.min(FONTS.length - 1, i + 1))} disabled={fontIdx === FONTS.length - 1} className={`size-11 ${ctrlBtn}`} title="Fonte maior">
                <Type className="size-6" />
              </button>

              <button onClick={() => jumpTo(current - 1)} disabled={current === 0} className={`size-12 ${ctrlBtn}`} title="Faixa anterior">
                <SkipBack className="size-6 fill-current" />
              </button>
              <button
                onClick={() => {
                  setPlaying((p) => !p);
                  bumpControls();
                }}
                className="inline-flex size-16 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90"
                title={playing ? "Pausar" : "Começar"}
              >
                {playing ? <Pause className="size-7 fill-current" /> : <Play className="size-7 fill-current" />}
              </button>
              <button onClick={() => jumpTo(current + 1)} disabled={current >= songs.length - 1} className={`size-12 ${ctrlBtn}`} title="Próxima faixa">
                <SkipForward className="size-6 fill-current" />
              </button>

              {mode === "full" ? (
                <button onClick={goHalf} className={`size-11 ${ctrlBtn}`} title="Minimizar (metade da tela)">
                  <Minimize className="size-5" />
                </button>
              ) : (
                <button onClick={enterFull} className={`size-11 ${ctrlBtn}`} title="Tela cheia">
                  <Maximize className="size-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
