"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, ExternalLink } from "lucide-react";
import { detectVideoEmbed } from "@/lib/video-embed";

/**
 * Player com comportamento adaptativo:
 * - Mobile: a capa é um link que abre o YouTube/Vimeo nativo (instantâneo).
 *   Sem fricção do iframe — controles do app nativo, performance flawless.
 * - Desktop: clica na capa e o player embedded carrega na mesma página, com
 *   pause/play via overlay + botão visível.
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
  const embed = detectVideoEmbed(url);
  const [active, setActive] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  if (embed.kind !== "embed") return null;

  const ytId =
    embed.provider === "youtube"
      ? (embed.src.match(/embed\/([\w-]{11})/)?.[1] ?? null)
      : null;
  const fallbackThumb = ytId
    ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
    : null;
  const showCover = cover ?? fallbackThumb;

  // ---- Mobile: SEMPRE abre nativo no provider ----
  if (mobile) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-video w-full bg-black relative group overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`Assistir ${title} no ${labelOf(embed.provider)}`}
      >
        <CoverInner cover={showCover} title={title} />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-3 py-1.5 text-xs text-white shadow-lg">
          Abrir no {labelOf(embed.provider)}
          <ExternalLink className="size-3.5" />
        </span>
      </a>
    );
  }

  // ---- Desktop: capa + embed na mesma página ----
  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="block aspect-video w-full bg-black relative group overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`Reproduzir ${title}`}
      >
        <CoverInner cover={showCover} title={title} />
      </button>
    );
  }
  if (embed.provider === "youtube") return <YouTubePlayer src={embed.src} title={title} />;
  if (embed.provider === "vimeo") return <VimeoPlayer src={embed.src} title={title} />;
  return <PassiveIframe src={`${embed.src}?autoplay=1`} title={title} />;
}

function labelOf(p: "youtube" | "vimeo" | "drive"): string {
  return p === "youtube" ? "YouTube" : p === "vimeo" ? "Vimeo" : "Drive";
}

/** Capa: imagem inteira + fundo desfocado da própria capa (Spotify-like) +
 *  botão play centralizado. Mesma markup pro <button> (desktop) e <a> (mobile). */
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
      {/* Imagem principal centralizada, sem corte */}
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

function PassiveIframe({ src, title }: { src: string; title: string }) {
  return (
    <div className="aspect-video bg-black">
      <iframe
        src={src}
        title={title}
        className="w-full h-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

function YouTubePlayer({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [paused, setPaused] = useState(false);

  function toggle() {
    if (!ref.current) return;
    const msg = paused
      ? '{"event":"command","func":"playVideo","args":""}'
      : '{"event":"command","func":"pauseVideo","args":""}';
    ref.current.contentWindow?.postMessage(msg, "*");
    setPaused((p) => !p);
  }

  const finalSrc =
    `${src}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0` +
    `&iv_load_policy=3&playsinline=1&enablejsapi=1`;

  return (
    <div className="aspect-video bg-black relative">
      <iframe
        ref={ref}
        src={finalSrc}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? "Tocar" : "Pausar"}
        className="absolute inset-0 focus:outline-none"
      />
      {paused && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/40">
          <div className="size-16 rounded-full bg-red-600/95 flex items-center justify-center shadow-lg">
            <Play className="size-7 text-white fill-white ml-1" />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={paused ? "Tocar" : "Pausar"}
        className="absolute bottom-3 right-3 size-11 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white hover:bg-black/90 shadow-lg z-10"
      >
        {paused ? (
          <Play className="size-5 fill-white ml-0.5" />
        ) : (
          <Pause className="size-5 fill-white" />
        )}
      </button>
    </div>
  );
}

function VimeoPlayer({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [paused, setPaused] = useState(false);

  function toggle() {
    if (!ref.current) return;
    const msg = JSON.stringify({ method: paused ? "play" : "pause" });
    ref.current.contentWindow?.postMessage(msg, "*");
    setPaused((p) => !p);
  }

  const finalSrc = `${src}?autoplay=1&title=0&byline=0&portrait=0&controls=0`;

  return (
    <div className="aspect-video bg-black relative">
      <iframe
        ref={ref}
        src={finalSrc}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? "Tocar" : "Pausar"}
        className="absolute inset-0 focus:outline-none"
      />
      {paused && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/40">
          <div className="size-16 rounded-full bg-red-600/95 flex items-center justify-center shadow-lg">
            <Play className="size-7 text-white fill-white ml-1" />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={paused ? "Tocar" : "Pausar"}
        className="absolute bottom-3 right-3 size-11 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white hover:bg-black/90 shadow-lg z-10"
      >
        {paused ? (
          <Play className="size-5 fill-white ml-0.5" />
        ) : (
          <Pause className="size-5 fill-white" />
        )}
      </button>
    </div>
  );
}
