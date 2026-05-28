"use client";

import { useEffect, useRef, useState } from "react";
import { Play, X, Loader2 } from "lucide-react";
import { detectVideoEmbed } from "@/lib/video-embed";

/**
 * Player híbrido para a página pública do contratante.
 *
 * Estratégia (Opção C): modal in-page com a capa "selando" o iframe
 * até o vídeo de fato começar a tocar. Isso resolve dois problemas:
 *  - Iframe demora pra "acender" e fica preto/feio → a capa cobre
 *    enquanto isso. Spinner discreto no canto pra mostrar atividade.
 *  - Fechar volta pra esta aba (X / ESC), sem mandar o contratante
 *    pro Drive/YouTube e perder o app.
 *
 * Tap em cima do vídeo pausa/retoma (YouTube via IFrame API; Vimeo via
 * postMessage). Drive não expõe API, então mantém os controles nativos.
 */
export function VideoPlayer({
  url,
  title,
  cover,
}: {
  url: string;
  title: string;
  cover?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const embed = detectVideoEmbed(url);
  if (embed.kind !== "embed") return null;

  const ytId =
    embed.provider === "youtube"
      ? (embed.src.match(/embed\/([\w-]{11})/)?.[1] ?? null)
      : null;
  const fallbackThumb = ytId
    ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
    : null;
  const showCover = cover ?? fallbackThumb;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block aspect-video w-full bg-black relative group overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`Assistir ${title}`}
      >
        <CoverInner cover={showCover} title={title} />
      </button>
      {open && (
        <VideoModal
          embed={embed}
          title={title}
          cover={showCover}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CoverInner({
  cover,
  title,
}: {
  cover: string | null;
  title: string;
}) {
  if (!cover) {
    return (
      <>
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          {title}
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="size-16 rounded-full bg-red-600/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="size-7 text-white fill-white ml-1" />
          </span>
        </span>
      </>
    );
  }
  return (
    <>
      {/* Fundo desfocado da própria capa */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
      />
      {/* Imagem principal centralizada */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt={title}
        className="relative w-full h-full object-contain opacity-95 group-hover:opacity-100 transition-opacity"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="size-16 rounded-full bg-red-600/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <Play className="size-7 text-white fill-white ml-1" />
        </span>
      </span>
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Modal                                                            */
/* ---------------------------------------------------------------- */

type Embed =
  | { kind: "embed"; provider: "youtube" | "vimeo" | "drive"; src: string };

// Carrega o IFrame Player API do YouTube uma única vez por sessão.
declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: Record<string, unknown>
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
  destroy: () => void;
};

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

function VideoModal({
  embed,
  title,
  cover,
  onClose,
}: {
  embed: Embed;
  title: string;
  cover: string | null;
  onClose: () => void;
}) {
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const vimeoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const driveIframeRef = useRef<HTMLIFrameElement | null>(null);

  // ESC fecha + trava scroll do body.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // YouTube — IFrame API com estados reais.
  useEffect(() => {
    if (embed.provider !== "youtube") return;
    const ytId = embed.src.match(/embed\/([\w-]{11})/)?.[1];
    if (!ytId || !ytHostRef.current) return;
    let cancelled = false;
    loadYouTubeAPI().then(() => {
      if (cancelled || !window.YT || !ytHostRef.current) return;
      ytPlayerRef.current = new window.YT.Player(ytHostRef.current, {
        videoId: ytId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          fs: 1,
        },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            e.target.playVideo();
          },
          onStateChange: (e: { data: number }) => {
            if (!window.YT) return;
            if (e.data === window.YT.PlayerState.PLAYING) {
              setHasPlayed(true);
              setPlaying(true);
            } else if (
              e.data === window.YT.PlayerState.PAUSED ||
              e.data === window.YT.PlayerState.ENDED
            ) {
              setPlaying(false);
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        ytPlayerRef.current?.destroy();
      } catch {
        // ignore
      }
      ytPlayerRef.current = null;
    };
  }, [embed]);

  // Vimeo — postMessage API. Sem player JS, só listen/post.
  useEffect(() => {
    if (embed.provider !== "vimeo") return;
    const iframe = vimeoIframeRef.current;
    if (!iframe) return;
    const onMessage = (e: MessageEvent) => {
      if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
      let data: { event?: string } | null = null;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        data = null;
      }
      if (!data) return;
      if (data.event === "play" || data.event === "playing") {
        setHasPlayed(true);
        setPlaying(true);
      } else if (data.event === "pause" || data.event === "ended") {
        setPlaying(false);
      }
    };
    window.addEventListener("message", onMessage);
    const onLoad = () => {
      const w = iframe.contentWindow;
      if (!w) return;
      for (const ev of ["play", "pause", "ended", "playing"]) {
        w.postMessage(
          JSON.stringify({ method: "addEventListener", value: ev }),
          "*"
        );
      }
      w.postMessage(JSON.stringify({ method: "play" }), "*");
    };
    iframe.addEventListener("load", onLoad);
    // Fallback: se nenhum evento chegar em 3s, libera a capa.
    const t = window.setTimeout(() => setHasPlayed(true), 3000);
    return () => {
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onLoad);
      window.clearTimeout(t);
    };
  }, [embed]);

  // Drive — sem API. Solta a capa quando o iframe carrega + 1.2s de buffer.
  useEffect(() => {
    if (embed.provider !== "drive") return;
    const iframe = driveIframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      window.setTimeout(() => setHasPlayed(true), 1200);
    };
    iframe.addEventListener("load", onLoad);
    // Fallback definitivo: 5s.
    const t = window.setTimeout(() => setHasPlayed(true), 5000);
    return () => {
      iframe.removeEventListener("load", onLoad);
      window.clearTimeout(t);
    };
  }, [embed]);

  // Tap no vídeo: pausa / retoma. Drive não tem API, deixa o nativo.
  function togglePlay() {
    if (embed.provider === "youtube") {
      const p = ytPlayerRef.current;
      if (!p || !window.YT) return;
      if (p.getPlayerState() === window.YT.PlayerState.PLAYING) {
        p.pauseVideo();
      } else {
        p.playVideo();
      }
    } else if (embed.provider === "vimeo") {
      const w = vimeoIframeRef.current?.contentWindow;
      if (!w) return;
      w.postMessage(
        JSON.stringify({ method: playing ? "pause" : "play" }),
        "*"
      );
      setPlaying((p) => !p);
    }
  }

  return (
    <div className="fixed inset-0 z-100 bg-black/95 flex flex-col">
      {/* Header com X */}
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <p className="font-medium truncate flex-1">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label="Fechar"
        >
          <X className="size-5" />
        </button>
      </div>
      {/* Palco do vídeo */}
      <div className="flex-1 flex items-center justify-center px-2 pb-4">
        <div className="relative w-full max-w-5xl aspect-video bg-black overflow-hidden rounded-lg">
          {/* Iframe / host */}
          {embed.provider === "youtube" && (
            <div ref={ytHostRef} className="absolute inset-0" />
          )}
          {embed.provider === "vimeo" && (
            <iframe
              ref={vimeoIframeRef}
              src={`${embed.src}?autoplay=1&title=0&byline=0&portrait=0`}
              title={title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          )}
          {embed.provider === "drive" && (
            <iframe
              ref={driveIframeRef}
              src={embed.src}
              title={title}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          )}

          {/* Capa cobrindo até o vídeo realmente tocar. */}
          {!hasPlayed && (
            <div className="absolute inset-0 z-10 bg-black pointer-events-none">
              {cover ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover}
                    alt={title}
                    className="relative w-full h-full object-contain"
                  />
                </>
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
                  {title}
                </span>
              )}
              {/* Spinner discreto no canto */}
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/80">
                <Loader2 className="size-3.5 animate-spin" />
                Carregando…
              </span>
            </div>
          )}

          {/* Overlay de tap pra pausar/retomar (YouTube/Vimeo). Drive usa controles nativos. */}
          {hasPlayed &&
            (embed.provider === "youtube" || embed.provider === "vimeo") && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pausar" : "Tocar"}
                className="absolute inset-0 z-20 bg-transparent focus:outline-none"
              />
            )}

          {/* Ícone central de play quando pausado (após já ter tocado). */}
          {hasPlayed &&
            !playing &&
            (embed.provider === "youtube" || embed.provider === "vimeo") && (
              <span className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <span className="size-16 rounded-full bg-red-600/95 flex items-center justify-center shadow-lg">
                  <Play className="size-7 text-white fill-white ml-1" />
                </span>
              </span>
            )}
        </div>
      </div>
    </div>
  );
}
