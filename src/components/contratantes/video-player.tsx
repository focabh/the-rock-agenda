"use client";

import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { detectVideoEmbed } from "@/lib/video-embed";

/**
 * Player híbrido pra página pública do contratante.
 *
 * Estratégia "lite-embed": o card é HTML puro (uma imagem + botão de play).
 * O iframe pesado do provider só nasce quando o contratante aperta play —
 * isso deixa a página inicial instantânea, mesmo com vários vídeos.
 *
 * Quando abre, o iframe roda com os controles NATIVOS do provider
 * (YouTube/Vimeo/Drive). Eles já são bons, principalmente no mobile:
 * fullscreen, scrub, volume, qualidade — tudo de graça.
 *
 * Modal preserva o "fechar volta pro app" via X ou ESC.
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block aspect-video w-full bg-black relative group overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`Assistir ${title}`}
      >
        <CoverInner cover={cover} ytId={ytId} title={title} />
      </button>
      {open && (
        <VideoModal embed={embed} title={title} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function CoverInner({
  cover,
  ytId,
  title,
}: {
  cover: string | null | undefined;
  ytId: string | null;
  title: string;
}) {
  // Prioridade: capa custom > thumb do YouTube (com fallback) > nada.
  if (!cover && !ytId) {
    return (
      <>
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          {title}
        </span>
        <PlayBadge />
      </>
    );
  }
  return (
    <>
      {cover ? (
        <CoverImg src={cover} title={title} />
      ) : (
        <YoutubeThumb id={ytId!} title={title} />
      )}
      <PlayBadge />
    </>
  );
}

function PlayBadge() {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="size-16 rounded-full bg-red-600/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
        <Play className="size-7 text-white fill-white ml-1" />
      </span>
    </span>
  );
}

function CoverImg({ src, title }: { src: string; title: string }) {
  return (
    <>
      {/* Fundo desfocado da própria capa */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
      />
      {/* Imagem principal centralizada */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        className="relative w-full h-full object-contain opacity-95 group-hover:opacity-100 transition-opacity"
      />
    </>
  );
}

/**
 * Tenta maxresdefault.jpg (1280x720, 16:9 puro). Se o vídeo não tem
 * versão HD, o YouTube devolve um placeholder cinza 120x90 — detecto
 * isso pelo naturalWidth e caio pra hqdefault.jpg (480x360, sempre
 * existe).
 */
function YoutubeThumb({ id, title }: { id: string; title: string }) {
  const [src, setSrc] = useState(
    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
  );
  const triedFallback = useRef(false);

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (triedFallback.current) return;
    if (e.currentTarget.naturalWidth <= 160) {
      triedFallback.current = true;
      setSrc(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    }
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        onLoad={handleLoad}
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        onLoad={handleLoad}
        className="relative w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity"
      />
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Modal — iframe nasce aqui, com controles nativos do provider     */
/* ---------------------------------------------------------------- */

type Embed = {
  kind: "embed";
  provider: "youtube" | "vimeo" | "drive";
  src: string;
};

function buildEmbedUrl(embed: Embed): string {
  if (embed.provider === "youtube") {
    // - controls=1 (default), rel=0 evita "outros vídeos relacionados".
    // - modestbranding=1 tira o logo do YouTube no canto.
    // - SEM playsinline: no iOS, isso faz o YouTube entrar automaticamente
    //   em fullscreen nativo do iOS quando o play começa (a única maneira
    //   de conseguir fullscreen no iOS Safari, que não suporta Fullscreen
    //   API em iframes).
    return `${embed.src}?autoplay=1&rel=0&modestbranding=1`;
  }
  if (embed.provider === "vimeo") {
    return `${embed.src}?autoplay=1&title=0&byline=0&portrait=0`;
  }
  // Drive já é /preview — sem parâmetros extras úteis.
  return embed.src;
}

function VideoModal({
  embed,
  title,
  onClose,
}: {
  embed: Embed;
  title: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ESC fecha + trava scroll do body + tenta entrar em fullscreen real.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Pede fullscreen no container — funciona em desktop/Android dentro do
    // gesto de tap que disparou a abertura do modal. iOS Safari não suporta
    // Fullscreen API em iframes, mas o YouTube já entra em fullscreen
    // nativo sozinho (graças ao playsinline removido na URL do embed).
    const el = containerRef.current;
    let triedFs = false;
    if (el?.requestFullscreen) {
      triedFs = true;
      el.requestFullscreen().catch(() => {
        // Ignora — usuário negou, ou navegador não topou. UX continua válida.
      });
    }

    // Se o usuário sai do fullscreen (ESC, botão sistema), fecha o modal
    // junto pra não deixar uma tela preta presa.
    const onFsChange = () => {
      if (triedFs && !document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-100 bg-black flex flex-col"
    >
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
      <div className="flex-1 flex items-center justify-center">
        <iframe
          src={buildEmbedUrl(embed)}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
