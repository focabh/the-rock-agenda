"use client";

import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { detectVideoEmbed } from "@/lib/video-embed";

/**
 * Player com toggle play/pause via overlay (postMessage API), sem mostrar
 * a barra de controles do provedor. Com capa custom, todos os providers
 * usam o "lite-pattern" (capa + play).
 *
 * - YouTube e Vimeo: overlay com play/pause programático.
 * - Google Drive: o player não tem API pública estável; cai em iframe lazy.
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

  if (embed.kind !== "embed") return null;

  // Capa preferida (custom > thumbnail do YouTube > nenhuma).
  const ytId =
    embed.provider === "youtube"
      ? (embed.src.match(/embed\/([\w-]{11})/)?.[1] ?? null)
      : null;
  const fallbackThumb = ytId
    ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
    : null;
  const showCover = cover ?? fallbackThumb;

  if (!active) {
    // Se não tem capa nenhuma (Vimeo/Drive sem capa custom), pula direto pro iframe.
    if (!showCover && embed.provider !== "youtube") {
      return <PassiveIframe src={embed.src} title={title} />;
    }
    return (
      <CoverPlay
        cover={showCover ?? fallbackThumb ?? ""}
        title={title}
        onPlay={() => setActive(true)}
      />
    );
  }

  if (embed.provider === "youtube") {
    return <YouTubePlayer src={embed.src} title={title} />;
  }
  if (embed.provider === "vimeo") {
    return <VimeoPlayer src={embed.src} title={title} />;
  }
  // Drive: sem API estável — só iframe.
  return (
    <PassiveIframe src={`${embed.src}?autoplay=1`} title={title} autoplay />
  );
}

function CoverPlay({
  cover,
  title,
  onPlay,
}: {
  cover: string;
  title: string;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="block aspect-video w-full bg-black relative group focus:outline-none focus:ring-2 focus:ring-primary overflow-hidden"
      aria-label={`Reproduzir ${title}`}
    >
      {/* Fundo: mesma imagem desfocada cobrindo tudo (estilo Spotify) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
      />
      {/* Imagem principal: aparece inteira, centralizada */}
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
    </button>
  );
}

function PassiveIframe({
  src,
  title,
  autoplay = false,
}: {
  src: string;
  title: string;
  autoplay?: boolean;
}) {
  return (
    <div className="aspect-video bg-black">
      <iframe
        src={src + (autoplay && !src.includes("autoplay=1") ? "?autoplay=1" : "")}
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

  // controls=0 some com a barra; modestbranding+rel+iv_load tiram sugestões;
  // playsinline impede fullscreen automático no iOS; enablejsapi habilita
  // o postMessage acima.
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
      {/* Overlay invisível: clique em qualquer lugar pausa/toca */}
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
      {/* Botão visível no canto (especialmente útil no celular) */}
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
