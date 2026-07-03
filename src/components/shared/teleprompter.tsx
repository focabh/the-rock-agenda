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
  Mic,
  Target,
} from "lucide-react";
import { MetronomeIcon } from "@/components/shared/metronome-icon";
import { Button } from "@/components/ui/button";
import { LyricsText } from "@/components/shared/lyrics-text";
import { parseLrc, parseCues, buildTimeline, activeLineIndex, decideEntryWarning, type AlertMode } from "@/lib/lrc";
import { parseVocalCues, cuesByLineText, normalizeLine } from "@/lib/vocal-cues";
import { PresetBadge } from "@/components/shared/preset-badge";
import { prepareAudioContext } from "@/lib/audio-unlock";

type Song = {
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  lyrics: string | null;
  durationSeg?: number | null;
  syncedLyrics?: string | null;
  cues?: string | null;
  bpm?: number | null;
  vozPedal?: string | null;
  vozPreset?: number | null;
  vozCueInicial?: string | null;
  vocalCues?: string | null;
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
const ALERT_KEY = "teleprompter-alert-mode-v1"; // ensaio | show | limpo
const CUES_KEY = "teleprompter-vocal-cues-v1"; // mostrar Vocal Cues (Stage Master)
const RATE_MIN = 0.5;
const RATE_MAX = 1.8;
const RATE_STEP = 0.05;
const DEFAULT_SPEED = 28; // px/s — já começa numa rolagem visível ao dar play
const MIN_SPEED = 2; // mínimo do slider (ajuste fino do usuário)
const AUTO_MIN_VISIBLE = 16; // piso da calibração automática — nunca "parado"
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
  const [alertMode, setAlertMode] = useState<AlertMode>("show"); // avisos: padrão discreto (Show)
  const [metroOn, setMetroOn] = useState(true); // metrônomo automático (BPM da música)
  const [metroBeat, setMetroBeat] = useState(-1);
  // Pulso pra moldura piscar no tempo (visual, ajuda quem está de in-ear).
  const [metroPulse, setMetroPulse] = useState<{ on: boolean; acc: boolean }>({ on: false, acc: false });
  const [activeIdx, setActiveIdx] = useState(-1); // linha ativa (modo sincronizado)
  const [showCues, setShowCues] = useState(true); // Stage Master: mostrar Vocal Cues
  const [cueNow, setCueNow] = useState<string[]>([]); // cue da linha atual (notificação discreta)
  const [calibStep, setCalibStep] = useState(0); // calibração por toque: 0 off, 1 aguarda 1º, 2 aguarda 2º
  const calibAnchor = useRef<{ t: number; real: number } | null>(null);
  const [rateView, setRateView] = useState(1); // ritmo do sync (1 = igual à gravação)
  const [songSec, setSongSec] = useState(0); // cronômetro do tempo-música (modo sync)
  const rateRef = useRef(1); // fonte de verdade do ritmo pro relógio
  const ratesMem = useRef<Record<string, number>>({});

  // Linha do tempo por música: versos (LRC) + marcações (intro/solo), ordenados.
  const timelines = useMemo(
    () => songs.map((s) => buildTimeline(parseLrc(s.syncedLyrics), parseCues(s.cues))),
    [songs]
  );
  // Sincronizado quando: AUTO ligado E a música atual tem timeline (letra sincronizada).
  const syncedCurrent = auto && (timelines[current]?.length ?? 0) > 0;
  // Stage Master: mapa texto-da-linha → Vocal Cues da música atual.
  const cueMap = useMemo(
    () => cuesByLineText(parseVocalCues(songs[current]?.vocalCues)),
    [songs, current]
  );
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
  // Enquanto o USUÁRIO rola (wheel/touch), não deixamos o auto-scroll brigar e
  // tratamos a rolagem como "seek" (a música pula pro ponto onde ele parou).
  const userSeekUntil = useRef(0);
  // Quando a troca de música veio de uma ROLAGEM (scrub p/ outra faixa), o efeito
  // de troca NÃO zera o relógio — a posição já foi setada pelo onScroll.
  const scrubbedCurrent = useRef(false);

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
    try {
      const m = localStorage.getItem(ALERT_KEY);
      if (m === "ensaio" || m === "show" || m === "limpo") setAlertMode(m);
    } catch {
      /* ignora */
    }
    try {
      const c = localStorage.getItem(CUES_KEY);
      if (c !== null) setShowCues(c === "1");
    } catch {
      /* ignora */
    }
  }, []);

  function toggleCues() {
    setShowCues((v) => {
      const next = !v;
      try {
        localStorage.setItem(CUES_KEY, next ? "1" : "0");
      } catch {
        /* ignora */
      }
      return next;
    });
    bumpControls();
  }

  function changeAlertMode(m: AlertMode) {
    setAlertMode(m);
    try {
      localStorage.setItem(ALERT_KEY, m);
    } catch {
      /* ignora */
    }
  }

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
      return Math.min(AUTO_MAX, Math.max(AUTO_MIN_VISIBLE, Math.round(el.offsetHeight / sec)));
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
      // Usuário rolando → não empurra (deixa ele posicionar; "scroll = posição").
      if (performance.now() < userSeekUntil.current) {
        last.current = ts;
        raf.current = requestAnimationFrame(step);
        return;
      }
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
      // Modo Rolar: ao dar play, recalibra a velocidade da música atual agora
      // (as seções já estão medidas) pra começar numa rolagem visível na hora.
      if (!syncedCurrent) applyForIndex(current);
    } else if (clock.current.startedAt != null) {
      clock.current.base += ((performance.now() - clock.current.startedAt) / 1000) * rateRef.current;
      clock.current.startedAt = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Ao trocar de música (ou abrir), zera o relógio e aplica o ritmo salvo dela.
  // EXCETO quando a troca veio de uma rolagem (scrub) — aí a posição já foi
  // setada pelo onScroll e NÃO pode ser zerada (senão "volta pro início").
  useEffect(() => {
    if (scrubbedCurrent.current) {
      scrubbedCurrent.current = false;
      return;
    }
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
    const lines = timelines[current];
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
        // NÃO rola enquanto o usuário está rolando (senão briga e "volta pro topo").
        if (performance.now() >= userSeekUntil.current) {
          // Na introdução (idx -1) já centraliza a 1ª linha (a que vai entrar).
          const q = idx >= 0 ? idx : 0;
          const target = scrollRef.current?.querySelector(`[data-tl="${current}-${q}"]`) as HTMLElement | null;
          target?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(id);
    };
  }, [open, playing, syncedCurrent, current, timelines]);

  // Stage Master: quando a linha ativa tiver Vocal Cue, mostra a notificação
  // discreta por alguns segundos e some (não interpreta nada — só exibe o texto).
  useEffect(() => {
    if (!showCues || !syncedCurrent || activeIdx < 0) {
      setCueNow([]);
      return;
    }
    const ln = timelines[current]?.[activeIdx];
    if (!ln || ln.cue) {
      setCueNow([]);
      return;
    }
    const cues = cueMap.get(normalizeLine(ln.text));
    if (!cues?.length) {
      setCueNow([]);
      return;
    }
    setCueNow(cues);
    const t = window.setTimeout(() => setCueNow([]), 5000);
    return () => clearTimeout(t);
  }, [activeIdx, current, showCues, syncedCurrent, cueMap, timelines]);

  // Metrônomo automático: clica no BPM da música atual enquanto toca. Reinicia
  // sozinho a cada troca de faixa. Discreto (volume baixo) e desligável.
  useEffect(() => {
    const bpm = songs[current]?.bpm ?? null;
    if (!open || !playing || !metroOn || !bpm || bpm <= 0) {
      setMetroBeat(-1);
      setMetroPulse({ on: false, acc: false });
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    let beat = 0;
    let next = 0;
    let timer = 0;
    let cancelled = false;
    const tickSound = (t: number, acento: boolean) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = acento ? 1400 : 880;
      g.gain.setValueAtTime(acento ? 0.16 : 0.1, t); // discreto
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    };
    const loop = () => {
      while (next < ctx.currentTime + 0.12) {
        const pos = beat % 4;
        const acc = pos === 0;
        tickSound(next, acc);
        // Beat + pulso da moldura agendados pro instante exato do clique.
        const delay = Math.max(0, (next - ctx.currentTime) * 1000);
        window.setTimeout(() => {
          if (cancelled) return;
          setMetroBeat(pos);
          setMetroPulse({ on: true, acc });
        }, delay);
        window.setTimeout(() => {
          if (cancelled) return;
          setMetroPulse((p) => ({ ...p, on: false }));
        }, delay + 90);
        next += 60 / bpm;
        beat = (beat + 1) % 4;
      }
      timer = window.setTimeout(loop, 25);
    };
    // Destrava no mobile (resume + iOS silencioso) antes de começar.
    prepareAudioContext(ctx).then(() => {
      if (cancelled) return;
      next = ctx.currentTime + 0.12;
      loop();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctx.close().catch(() => {});
      setMetroBeat(-1);
      setMetroPulse({ on: false, acc: false });
    };
  }, [open, playing, metroOn, current, songs]);

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

  // Marca que a rolagem é do USUÁRIO (wheel/touch) — só esses eventos disparam,
  // a rolagem programática (scrollIntoView) não. Abre a janela de "seek".
  function markUserScroll() {
    userSeekUntil.current = performance.now() + 1400;
    bumpControls();
  }

  // Detecta a música atual pela rolagem + (se for rolagem do usuário em modo
  // sincronizado) faz SEEK: a música pula pro ponto onde ele rolou.
  function onScroll() {
    if (scrollTick.current) return;
    scrollTick.current = true;
    requestAnimationFrame(() => {
      scrollTick.current = false;
      const el = scrollRef.current;
      if (!el) return;
      // Coordenadas de VIEWPORT (getBoundingClientRect) — robusto, não depende de
      // offsetParent (offsetTop dava posição errada → seek na linha errada).
      const rect = el.getBoundingClientRect();
      const refY = rect.top + rect.height * 0.42; // ponto de referência (perto do centro)

      const centerY = rect.top + rect.height / 2;
      const userScrolling = performance.now() < userSeekUntil.current;
      // Linha (de uma música qualquer) mais próxima do centro da tela.
      const nearestLine = (songIdx: number): number => {
        let bestJ = -1;
        let bestDist = Infinity;
        el.querySelectorAll<HTMLElement>(`[data-tl^="${songIdx}-"]`).forEach((node) => {
          const r = node.getBoundingClientRect();
          const c = r.top + r.height / 2;
          const d = Math.abs(c - centerY);
          if (d < bestDist) {
            bestDist = d;
            bestJ = Number(node.dataset.tl?.split("-")[1] ?? -1);
          }
        });
        return bestJ;
      };

      // 1) Qual música está nesse ponto.
      let idx = 0;
      for (let i = 0; i < sectionRefs.current.length; i++) {
        const sec = sectionRefs.current[i];
        if (sec && sec.getBoundingClientRect().top <= refY) idx = i;
      }

      // 2) Trocou de música.
      if (idx !== current) {
        const syncedTarget = auto && (timelines[idx]?.length ?? 0) > 0;
        // Scrub do usuário pra OUTRA música sincronizada → continua DAQUELE ponto
        // (não reinicia a música nova do zero).
        if (userScrolling && syncedTarget) {
          const j = nearestLine(idx);
          const ln = j >= 0 ? timelines[idx][j] : null;
          scrubbedCurrent.current = true;
          setCurrent(idx);
          clock.current.base = ln ? Math.max(0, ln.t) : 0;
          clock.current.startedAt = playingRef.current ? performance.now() : null;
          setActiveIdx(j >= 0 ? j : -1);
          setSongSec(ln ? Math.floor(ln.t) : 0);
          const k = songs[idx] ? songKey(songs[idx]) : null;
          rateRef.current = (k && ratesMem.current[k]) || 1;
          setRateView(rateRef.current);
        } else {
          setCurrent(idx);
          applyForIndex(idx);
        }
        return;
      }

      // 3) Seek DENTRO da música atual (sync + rolagem do usuário): re-baseia o
      //    relógio na linha mais próxima do centro → "continua de onde rolou".
      if (syncedCurrent && userScrolling && timelines[current]?.length) {
        const j = nearestLine(current);
        const ln = j >= 0 ? timelines[current][j] : null;
        if (ln) {
          clock.current.base = Math.max(0, ln.t);
          if (clock.current.startedAt != null) clock.current.startedAt = performance.now();
          setActiveIdx(j);
          setSongSec(Math.floor(ln.t));
        }
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
    const lines = timelines[current];
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

  // Toque numa linha (modo Sync): pula o relógio pro tempo daquela linha.
  // Linha de outra música → só pula pra ela (o relógio dela reinicia do zero).
  function seekToLine(i: number, j: number, t: number) {
    if (i !== current) {
      jumpTo(i);
      return;
    }
    const tt = Math.max(0, t);
    clock.current.base = tt;
    clock.current.startedAt = playingRef.current ? performance.now() : null;
    setSongSec(Math.floor(tt));
    setActiveIdx(activeLineIndex(timelines[i], tt));
    const el = scrollRef.current?.querySelector(`[data-tl="${i}-${j}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    bumpControls();
  }

  // Calibração por TOQUE (acerta início + ritmo de uma vez, sem depender de o
  // usuário dar play no instante exato nem de a banda tocar no tempo do disco):
  // toca na linha que está sendo cantada AGORA (marca 1) e, depois, em outra
  // linha quando ela chegar (marca 2). Com os 2 pontos dá pra achar o ritmo real.
  function startCalibration() {
    if (calibStep > 0) {
      // cancelar
      calibAnchor.current = null;
      setCalibStep(0);
      bumpControls();
      return;
    }
    calibAnchor.current = null;
    setCalibStep(1);
    bumpControls();
  }

  function alignClockTo(lineT: number, now: number) {
    clock.current.base = Math.max(0, lineT);
    if (clock.current.startedAt != null) clock.current.startedAt = now;
    setActiveIdx(activeLineIndex(timelines[current], lineT));
    setSongSec(Math.floor(Math.max(0, lineT)));
  }

  function calibrationTap(lineT: number) {
    const now = performance.now();
    if (calibStep === 1) {
      calibAnchor.current = { t: lineT, real: now };
      alignClockTo(lineT, now); // já cola a letra na linha certa (offset)
      setCalibStep(2);
      bumpControls();
      return;
    }
    if (calibStep === 2 && calibAnchor.current) {
      const a = calibAnchor.current;
      const realDelta = (now - a.real) / 1000;
      const songDelta = lineT - a.t;
      // Intervalo curto/inválido (tocou cedo demais ou numa linha anterior) →
      // ignora e continua esperando uma 2ª marca boa.
      if (realDelta <= 0.6 || songDelta <= 0.6) {
        bumpControls();
        return;
      }
      const r = Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round((songDelta / realDelta) * 100) / 100));
      rateRef.current = r;
      setRateView(r);
      alignClockTo(lineT, now);
      const k = songs[current] ? songKey(songs[current]) : null;
      if (k) {
        ratesMem.current[k] = r;
        try {
          localStorage.setItem(RATE_KEY, JSON.stringify(ratesMem.current));
        } catch {
          /* ignora */
        }
      }
      calibAnchor.current = null;
      setCalibStep(0);
      bumpControls();
    }
  }

  // Toque numa linha: em calibração vira "marca"; senão, seek normal.
  function onLineTap(i: number, j: number, t: number) {
    if (calibStep > 0) {
      if (i === current) calibrationTap(t);
      return;
    }
    if (showControls) seekToLine(i, j, t);
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

  // Aviso de entrada vocal — decidido de forma centralizada (lib/lrc).
  // Modo "show" (discreto, padrão): só avisa nos últimos segundos e só depois
  // de um trecho instrumental relevante. "ensaio" mostra mais; "limpo" nada.
  const warning =
    playing && syncedCurrent
      ? decideEntryWarning(timelines[current] ?? [], songSec, alertMode)
      : { shouldShowWarning: false, warningText: "", warningType: null };

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
            <span className="pointer-events-auto flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-amber-400">
                {songs[current] ? `${songs[current].n}. ${songs[current].titulo}` : ""}
                {songs[current]?.tom ? ` · ${songs[current].tom}` : ""}
              </span>
              <PresetBadge preset={songs[current]?.vozPreset} variant="solid" />
              {showCues && songs[current]?.vozCueInicial && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
                  <Mic className="size-3" />
                  {songs[current]?.vozCueInicial}
                </span>
              )}
            </span>
            <button
              onClick={close}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              title="Sair do teleprompter (voltar pras letras)"
            >
              <X className="size-4" /> Sair
            </button>
          </div>

          {/* Metrônomo visual: moldura pisca no tempo (âmbar no tempo 1) — ajuda
              quem está de in-ear a seguir o andamento sem depender do som. */}
          {metroOn && (
            <div
              className="pointer-events-none absolute inset-0 z-10 transition-shadow duration-75"
              style={{
                boxShadow: metroPulse.on
                  ? `inset 0 0 0 10px ${metroPulse.acc ? "rgba(245,158,11,0.85)" : "rgba(255,255,255,0.45)"}`
                  : "inset 0 0 0 10px transparent",
              }}
            />
          )}

          {/* Metrônomo: bolinhas discretas no topo (sempre visíveis durante o play) */}
          {metroOn && metroBeat >= 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1.5 z-10 flex items-center justify-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`size-2 rounded-full transition-colors ${
                    metroBeat === i ? (i === 0 ? "bg-primary" : "bg-amber-400") : "bg-white/20"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Aviso discreto de entrada vocal (só quando dá pra perder a entrada) */}
          {warning.shouldShowWarning && (
            <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center">
              <span className="rounded-full bg-amber-500/85 px-3 py-1 text-xs font-bold text-black shadow-md">
                {warning.warningText}
              </span>
            </div>
          )}

          {/* Calibração por toque: instrução clara enquanto ativa */}
          {calibStep > 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-6">
              <span className="rounded-2xl bg-amber-400 px-5 py-3 text-center text-lg font-black text-black shadow-2xl">
                {calibStep === 1
                  ? "🎯 Toque na linha que está sendo cantada AGORA"
                  : "🎯 Agora toque em OUTRA linha quando ela chegar"}
              </span>
            </div>
          )}

          {/* Stage Master: Vocal Cue da linha atual — notificação discreta */}
          {showCues && cueNow.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex flex-wrap justify-center gap-1.5 px-4">
              {cueNow.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/95 px-3 py-1 text-sm font-bold text-black shadow-lg ring-1 ring-black/10"
                >
                  <Mic className="size-3.5" /> {c}
                </span>
              ))}
            </div>
          )}

          {/* Letras rolando — toque mostra/esconde controles */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            onWheel={markUserScroll}
            onTouchMove={markUserScroll}
            onPointerDown={() => bumpControls()}
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
                  {s.vozPreset != null && s.vozPreset > 0 && (
                    <div className="mb-5 flex justify-center">
                      <span className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2 text-2xl font-black uppercase tracking-wide text-white shadow-lg">
                        Preset {s.vozPreset}
                      </span>
                    </div>
                  )}
                  {showCues && s.vozCueInicial?.trim() && (
                    <div className="mb-5 flex justify-center">
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-1.5 text-base font-bold text-amber-300 ring-1 ring-inset ring-amber-500/40">
                        <Mic className="size-4" /> {s.vozCueInicial}
                      </span>
                    </div>
                  )}
                  {auto && timelines[i].length > 0 ? (
                    // Modo sincronizado: linha a linha, a atual em destaque (estilo Spotify).
                    // Marcações (intro/solo) aparecem como selo 🎸.
                    <div className={`space-y-3 font-semibold leading-[1.3] ${FONTS[fontIdx]}`}>
                      {timelines[i].map((ln, j) => {
                        const isCur = i === current;
                        const active = isCur && j === activeIdx;
                        const upcoming = isCur && activeIdx < 0 && j === 0; // 1ª entrada na intro
                        const lineCues =
                          showCues && isCur && !ln.cue ? cueMap.get(normalizeLine(ln.text)) : null;
                        if (ln.cue) {
                          return (
                            <p
                              key={j}
                              data-tl={`${i}-${j}`}
                              onClick={() => onLineTap(i, j, ln.t)}
                              className="cursor-pointer"
                              title="Com os controles à vista, toque pra pular pra aqui"
                            >
                              <span
                                className={`inline-block rounded-full px-4 py-1 text-[0.5em] font-bold uppercase tracking-wide ${
                                  active ? "bg-amber-400 text-black" : "bg-amber-400/20 text-amber-300"
                                }`}
                              >
                                🎸 {ln.text}
                              </span>
                            </p>
                          );
                        }
                        return (
                          <p
                            key={j}
                            data-tl={`${i}-${j}`}
                            onClick={() => onLineTap(i, j, ln.t)}
                            title="Com os controles à vista, toque pra pular pra aqui"
                            className={
                              "cursor-pointer rounded-lg transition-all hover:bg-white/5 " +
                              (active ? "text-white" : upcoming ? "text-white/80" : "text-white/45")
                            }
                          >
                            {ln.text}
                            {lineCues?.length ? (
                              <span className="mt-1 flex flex-wrap justify-center gap-1.5">
                                {lineCues.map((c, k) => (
                                  <span
                                    key={k}
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.32em] font-bold uppercase tracking-wide ${
                                      active
                                        ? "bg-amber-400 text-black"
                                        : "bg-amber-400/20 text-amber-300"
                                    }`}
                                  >
                                    🎤 {c}
                                  </span>
                                ))}
                              </span>
                            ) : null}
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
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 wrap-break-word font-medium leading-snug">{s.titulo}</span>
                        <span className="block truncate text-sm text-white/40">{s.artista}</span>
                      </span>
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
                      {activeIdx >= 0 ? `linha ${activeIdx + 1}/${timelines[current].length}` : "introdução (letra espera)"}
                    </div>
                  </div>
                  <button onClick={() => setSongRate(rateView + RATE_STEP)} className={`h-9 px-2 ${ctrlBtn}`} title="Mais rápido (banda tocando mais rápido)">
                    <Plus className="size-5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => nudge(-1)} className={`h-8 rounded-full px-3 text-xs ${ctrlBtn}`} title="Atrasar 1s">
                    −1s
                  </button>
                  <button onClick={resync} className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs ${ctrlBtn}`} title="Recomeçar do zero — aperte quando a música começar">
                    <RotateCcw className="size-3.5" /> recomeçar
                  </button>
                  <button onClick={() => nudge(1)} className={`h-8 rounded-full px-3 text-xs ${ctrlBtn}`} title="Adiantar 1s">
                    +1s
                  </button>
                  <button
                    onClick={startCalibration}
                    className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold ring-1 transition-colors ${
                      calibStep > 0 ? "bg-amber-400 text-black ring-amber-400" : `${ctrlBtn} ring-white/20`
                    }`}
                    title="Acertar o ritmo tocando: toque na linha cantada agora e depois em outra linha quando ela chegar"
                  >
                    <Target className="size-3.5" /> {calibStep > 0 ? "cancelar" : "acertar ritmo"}
                  </button>
                </div>
                {/* Modo de alertas: Show (discreto) é o padrão pro palco. */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">Alertas</span>
                  <div className="inline-flex h-7 overflow-hidden rounded-full ring-1 ring-white/20">
                    {([
                      ["ensaio", "Ensaio"],
                      ["show", "Show"],
                      ["limpo", "Limpo"],
                    ] as const).map(([m, lbl]) => (
                      <button
                        key={m}
                        onClick={() => changeAlertMode(m)}
                        className={`px-3 text-xs font-semibold transition-colors ${
                          alertMode === m ? "bg-amber-400 text-black" : "text-white/70 hover:text-white"
                        }`}
                        title={
                          m === "ensaio"
                            ? "Mostra mais contadores (bom pra ensaiar)"
                            : m === "show"
                              ? "Discreto: só avisa antes de entradas após intro/solo/ponte"
                              : "Só letra, sem nenhum aviso"
                        }
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
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
            <div className="flex flex-wrap items-center justify-center gap-1.5">
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
                      : (timelines[current]?.length ?? 0) > 0
                        ? "text-white/70 hover:text-white"
                        : "text-white/30"
                  }`}
                  title="Sincronizado com a música (estilo Spotify). Funciona tocando junto com o áudio original."
                >
                  <Sparkles className="size-4" /> Sync
                </button>
              </div>
              <button
                onClick={() => setMetroOn((v) => !v)}
                className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold ring-1 transition-colors ${
                  metroOn
                    ? "bg-amber-400 text-black ring-amber-400"
                    : "text-white/70 ring-white/25 hover:text-white"
                }`}
                title={
                  songs[current]?.bpm
                    ? `Metrônomo: marca o tempo da música (som + moldura piscando) a ${songs[current]?.bpm} BPM. Toque pra ${metroOn ? "desligar" : "ligar"}.`
                    : "Metrônomo — esta música não tem BPM cadastrado (defina no repertório)"
                }
              >
                <MetronomeIcon className="size-4" />
                <span className="font-mono">
                  {songs[current]?.bpm ? songs[current]?.bpm : "BPM"}
                </span>
              </button>
              <button
                onClick={toggleCues}
                className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold ring-1 transition-colors ${
                  showCues
                    ? "bg-amber-400 text-black ring-amber-400"
                    : "text-white/70 ring-white/25 hover:text-white"
                }`}
                title={`Vocal Cues (Stage Master): ${showCues ? "tocando — toque pra esconder" : "escondidos — toque pra mostrar"}`}
              >
                <Mic className="size-4" /> Cues
              </button>
              <button onClick={() => setShowList(true)} className={`size-11 ${ctrlBtn}`} title="Lista de músicas">
                <ListMusic className="size-5" />
              </button>
              <button onClick={() => setFontIdx((i) => Math.max(0, i - 1))} disabled={fontIdx === 0} className={`size-11 ${ctrlBtn}`} title="Fonte menor">
                <Type className="size-4" />
              </button>
              <button onClick={() => setFontIdx((i) => Math.min(FONTS.length - 1, i + 1))} disabled={fontIdx === FONTS.length - 1} className={`size-11 ${ctrlBtn}`} title="Fonte maior">
                <Type className="size-6" />
              </button>

              <button onClick={() => { setPlaying(true); jumpTo(current - 1); }} disabled={current === 0} className={`size-12 ${ctrlBtn}`} title="Faixa anterior (já começa)">
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
              <button onClick={() => { setPlaying(true); jumpTo(current + 1); }} disabled={current >= songs.length - 1} className={`size-12 ${ctrlBtn}`} title="Próxima faixa (já começa)">
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
