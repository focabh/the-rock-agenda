"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LyricsText } from "@/components/shared/lyrics-text";
import { parseLrc, activeLineIndex } from "@/lib/lrc";

type Song = {
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  lyrics: string | null;
  durationSeg?: number | null;
  syncedLyrics?: string | null;
};

// Tamanhos responsivos: já começam grandes no celular.
const FONTS = [
  "text-3xl sm:text-4xl",
  "text-4xl sm:text-5xl",
  "text-5xl sm:text-6xl",
  "text-6xl sm:text-7xl",
  "text-7xl sm:text-8xl",
  "text-8xl sm:text-9xl",
];
const SPEED_KEY = "teleprompter-speeds-v1"; // overrides do usuário, por música
const RATE_KEY = "teleprompter-rates-v1"; // ritmo do sync por música (1 = igual à gravação)
const AUTO_KEY = "teleprompter-auto-v1";
const RATE_MIN = 0.5;
const RATE_MAX = 1.8;
const RATE_STEP = 0.05;
const DEFAULT_SPEED = 18; // px/s — bem lento por padrão
const MIN_SPEED = 2;
const MAX_SPEED = 90;
const STEP = 3; // passo dos botões -/+
const AUTO_MAX = 55; // teto da calibração automática (nunca absurdo)
const AUTO_FALLBACK_SEG = 210; // sem duração, assume ~3min30 pra calibrar

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
  const [auto, setAuto] = useState(true); // Inteliprompter: calibra por música
  const [activeIdx, setActiveIdx] = useState(-1); // linha ativa (modo sincronizado)
  const [rateView, setRateView] = useState(1); // ritmo do sync (1 = igual à gravação)
  const [songSec, setSongSec] = useState(0); // cronômetro do tempo-música (modo sync)
  const rateRef = useRef(1); // fonte de verdade do ritmo pro relógio
  const ratesMem = useRef<Record<string, number>>({});

  // Letra sincronizada (LRC) por música → modo Inteliprompter "no tempo real".
  const syncedLines = useMemo(
    () => songs.map((s) => parseLrc(s.syncedLyrics).filter((l) => l.text)),
    [songs]
  );
  // Sincronizado quando: AUTO ligado E a música atual tem letra sincronizada.
  const syncedCurrent = auto && (syncedLines[current]?.length ?? 0) > 0;
  // Relógio do modo sincronizado: base acumulada + início do segmento tocando.
  const clock = useRef<{ base: number; startedAt: number | null }>({ base: 0, startedAt: null });
  // Tempo da MÚSICA (segundos) = base + tempo real decorrido × ritmo.
  const elapsed = () =>
    clock.current.base +
    (clock.current.startedAt != null ? ((performance.now() - clock.current.startedAt) / 1000) * rateRef.current : 0);

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

  // Carrega memória de velocidade por música + preferência do Inteliprompter.
  useEffect(() => {
    try {
      speeds.current = JSON.parse(localStorage.getItem(SPEED_KEY) || "{}");
    } catch {
      speeds.current = {};
    }
    try {
      ratesMem.current = JSON.parse(localStorage.getItem(RATE_KEY) || "{}");
    } catch {
      ratesMem.current = {};
    }
    try {
      const a = localStorage.getItem(AUTO_KEY);
      if (a !== null) setAuto(a === "1");
    } catch {
      /* ignora */
    }
  }, []);

  // Velocidade ideal pra uma música: override do usuário vence; senão, calibra
  // pela duração (altura da letra ÷ duração), com teto pra nunca ficar absurda.
  function speedForIndex(idx: number): number | null {
    const s = songs[idx];
    if (!s) return null;
    const ov = speeds.current[songKey(s)];
    if (ov) return ov;
    // Calibra sempre pela duração (modo "Rolar"): altura da letra ÷ duração.
    const sec = s.durationSeg && s.durationSeg > 0 ? s.durationSeg : AUTO_FALLBACK_SEG;
    const el = sectionRefs.current[idx];
    if (el && el.offsetHeight > 0) {
      return Math.min(AUTO_MAX, Math.max(MIN_SPEED, Math.round(el.offsetHeight / sec)));
    }
    return null;
  }

  function applyForIndex(idx: number) {
    const v = speedForIndex(idx);
    if (v != null) setSpeed(v);
  }

  // Loop de rolagem CONSTANTE (só quando NÃO está no modo sincronizado).
  useEffect(() => {
    if (!open || !playing || syncedCurrent) return;
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
  }, [open, playing, speed, syncedCurrent]);

  // Liga/desliga o relógio do modo sincronizado conforme play/pause.
  useEffect(() => {
    if (playing) {
      if (clock.current.startedAt == null) clock.current.startedAt = performance.now();
    } else if (clock.current.startedAt != null) {
      clock.current.base += ((performance.now() - clock.current.startedAt) / 1000) * rateRef.current;
      clock.current.startedAt = null;
    }
  }, [playing]);

  // Ao trocar de música (ou abrir), zera o relógio e aplica o ritmo salvo dela.
  useEffect(() => {
    clock.current.base = 0;
    clock.current.startedAt = playingRef.current ? performance.now() : null;
    setActiveIdx(-1);
    setSongSec(0);
    const k = songs[current] ? songKey(songs[current]) : null;
    const r = (k && ratesMem.current[k]) || 1;
    rateRef.current = r;
    setRateView(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, open]);

  // Motor SINCRONIZADO: rola a letra no tempo real da música (LRC). A linha
  // atual fica centralizada; na introdução/instrumental a letra espera parada.
  // Usa um rAF PRÓPRIO (id local) pra não conflitar com a rolagem constante.
  useEffect(() => {
    if (!open || !playing || !syncedCurrent) return;
    const lines = syncedLines[current];
    let id = 0;
    let active = true;
    let lastIdx = -2;
    let lastSec = -1;
    const tick = () => {
      if (!active) return;
      const e = elapsed();
      const sec = Math.floor(e);
      if (sec !== lastSec) {
        lastSec = sec;
        setSongSec(sec); // cronômetro ao vivo (prova que o Play está correndo)
      }
      const idx = activeLineIndex(lines, e);
      if (idx !== lastIdx) {
        lastIdx = idx;
        setActiveIdx(idx);
        // Na introdução (idx -1) já centraliza a 1ª linha (a que vai entrar).
        const q = idx >= 0 ? idx : 0;
        const target = scrollRef.current?.querySelector(`[data-tl="${current}-${q}"]`) as HTMLElement | null;
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(id);
    };
  }, [open, playing, syncedCurrent, current, syncedLines]);

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
      // Calibra a 1ª música assim que as seções renderizam.
      requestAnimationFrame(() => requestAnimationFrame(() => applyForIndex(0)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Ao ligar/desligar o Inteliprompter, recalibra a música atual e persiste.
  useEffect(() => {
    try {
      localStorage.setItem(AUTO_KEY, auto ? "1" : "0");
    } catch {
      /* ignora */
    }
    if (open) applyForIndex(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

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
        applyForIndex(idx); // override do usuário ou calibração automática
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

  // Ajuste fino do tempo (modo sincronizado): empurra/atrasa a letra.
  function nudge(delta: number) {
    clock.current.base = Math.max(0, clock.current.base + delta);
    const lines = syncedLines[current];
    const idx = activeLineIndex(lines, elapsed());
    setActiveIdx(idx);
    const target =
      idx >= 0
        ? (scrollRef.current?.querySelector(`[data-tl="${current}-${idx}"]`) as HTMLElement | null)
        : sectionRefs.current[current];
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    bumpControls();
  }

  // Ritmo do sync: a banda toca mais rápido/devagar que a gravação. Re-baseia o
  // relógio (continuidade) e guarda por música.
  function setSongRate(r: number) {
    const clamped = Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(r * 100) / 100));
    const cur = elapsed(); // tempo-música atual com o ritmo antigo
    clock.current.base = cur;
    if (clock.current.startedAt != null) clock.current.startedAt = performance.now();
    rateRef.current = clamped;
    setRateView(clamped);
    const k = songs[current] ? songKey(songs[current]) : null;
    if (k) {
      ratesMem.current[k] = clamped;
      try {
        localStorage.setItem(RATE_KEY, JSON.stringify(ratesMem.current));
      } catch {
        /* ignora */
      }
    }
    bumpControls();
  }

  // Recomeça a sincronização do zero (apertar quando a música começar).
  function resync() {
    clock.current.base = 0;
    clock.current.startedAt = playingRef.current ? performance.now() : null;
    setActiveIdx(-1);
    sectionRefs.current[current]?.scrollIntoView({ block: "center", behavior: "smooth" });
    bumpControls();
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

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={rootRef}
          className={`fixed z-100 flex flex-col bg-black text-white ${
            mode === "full"
              ? "left-0 top-0 h-dvh w-screen"
              : "inset-x-0 bottom-0 h-[58dvh] rounded-t-2xl border-t border-white/20 shadow-2xl"
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
                  {auto && syncedLines[i].length > 0 ? (
                    // Modo sincronizado: linha a linha, a atual em destaque (estilo Spotify).
                    <div className={`space-y-3 font-semibold leading-[1.3] ${FONTS[fontIdx]}`}>
                      {syncedLines[i].map((ln, j) => {
                        const isCur = i === current;
                        const active = isCur && j === activeIdx;
                        const upcoming = isCur && activeIdx < 0 && j === 0; // 1ª linha na intro
                        return (
                          <p
                            key={j}
                            data-tl={`${i}-${j}`}
                            className={
                              active
                                ? "text-white transition-all"
                                : upcoming
                                  ? "text-white/80 transition-all"
                                  : "text-white/45 transition-all"
                            }
                          >
                            {ln.text}
                          </p>
                        );
                      })}
                    </div>
                  ) : s.lyrics?.trim() ? (
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
            {syncedCurrent ? (
              /* Modo sincronizado: ritmo (banda mais rápida/lenta) + ajuste fino + recomeçar */
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSongRate(rateView - RATE_STEP)} className={`h-9 px-2 ${ctrlBtn}`} title="Mais devagar (banda tocando mais lento)">
                    <Minus className="size-5" />
                  </button>
                  <div className="flex-1 text-center">
                    <div className="font-mono text-sm font-bold text-amber-300">
                      ritmo {Math.round(rateView * 100)}%
                    </div>
                    <div className="font-mono text-[11px] text-white/55">
                      {Math.floor(songSec / 60)}:{String(songSec % 60).padStart(2, "0")} ·{" "}
                      {activeIdx >= 0 ? `linha ${activeIdx + 1}/${syncedLines[current].length}` : "introdução (letra espera)"}
                    </div>
                  </div>
                  <button onClick={() => setSongRate(rateView + RATE_STEP)} className={`h-9 px-2 ${ctrlBtn}`} title="Mais rápido (banda tocando mais rápido)">
                    <Plus className="size-5" />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => nudge(-1)} className={`h-8 rounded-full px-3 text-xs ${ctrlBtn}`} title="Atrasar 1s">
                    −1s
                  </button>
                  <button onClick={resync} className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs ${ctrlBtn}`} title="Recomeçar do zero — aperte quando a música começar">
                    <RotateCcw className="size-3.5" /> recomeçar
                  </button>
                  <button onClick={() => nudge(1)} className={`h-8 rounded-full px-3 text-xs ${ctrlBtn}`} title="Adiantar 1s">
                    +1s
                  </button>
                </div>
              </div>
            ) : (
              /* Velocidade — slider fino (modo rolagem constante) */
              <div className="flex items-center gap-3">
                <button onClick={() => changeSpeed(speed - STEP)} className={`size-9 ${ctrlBtn}`} title="Mais devagar">
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
                <button onClick={() => changeSpeed(speed + STEP)} className={`size-9 ${ctrlBtn}`} title="Mais rápido">
                  <Plus className="size-5" />
                </button>
                <span className="w-20 text-right font-mono text-xs text-white/60">
                  {speed} px/s{songs[current] && !speeds.current[songKey(songs[current])] ? " ·auto" : ""}
                </span>
              </div>
            )}

            {/* Linha de transporte */}
            <div className="flex items-center justify-center gap-1.5">
              {/* Seletor de modo: Rolar (rolagem suave) ou Sync (no tempo da música). */}
              <div className="inline-flex h-11 shrink-0 items-center overflow-hidden rounded-full ring-1 ring-white/25">
                <button
                  onClick={() => setAuto(false)}
                  className={`h-full px-3 text-sm font-bold transition-colors ${
                    !auto ? "bg-white text-black" : "text-white/70 hover:text-white"
                  }`}
                  title="Rolagem suave (velocidade calibrada por música)"
                >
                  Rolar
                </button>
                <button
                  onClick={() => setAuto(true)}
                  className={`inline-flex h-full items-center gap-1 px-3 text-sm font-bold transition-colors ${
                    auto
                      ? "bg-amber-400 text-black"
                      : (syncedLines[current]?.length ?? 0) > 0
                        ? "text-white/70 hover:text-white"
                        : "text-white/30"
                  }`}
                  title="Sincronizado com a música (estilo Spotify). Funciona tocando junto com o áudio original."
                >
                  <Sparkles className="size-4" /> Sync
                </button>
              </div>
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
        </div>,
        document.body
      )}
    </>
  );
}
