"use client";

import { useEffect, useState } from "react";
import { Play, X, Loader2 } from "lucide-react";
import { detectVideoEmbed } from "@/lib/video-embed";

/**
 * Vídeo: capa cobre o player com fundo desfocado da própria imagem;
 * clique abre um modal in-page com o vídeo (mesma experiência em mobile,
 * desktop, ou PWA — fechar com X sempre devolve pra página).
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
        aria-label={`Reproduzir ${title}`}
      >
        <CoverInner cover={showCover} title={title} />
      </button>
      {open && (
        <VideoModal
          provider={embed.provider}
          embedSrc={embed.src}
          title={title}
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

function VideoModal({
  provider,
  embedSrc,
  title,
  onClose,
}: {
  provider: "youtube" | "vimeo" | "drive";
  embedSrc: string;
  title: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);

  // Trava scroll do body + suporte a ESC.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Safety: tira o spinner depois de 8s caso onLoad não dispare.
    const t = setTimeout(() => setLoading(false), 8000);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [onClose]);

  // Constrói URL de embed com autoplay e controles nativos do provider.
  let src = `${embedSrc}?autoplay=1`;
  if (provider === "youtube") {
    src =
      `${embedSrc}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3` +
      `&playsinline=1`;
  } else if (provider === "vimeo") {
    src = `${embedSrc}?autoplay=1&title=0&byline=0&portrait=0`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-white font-medium truncate">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
        >
          <X className="size-4" />
          Fechar
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
        <div className="aspect-video w-full max-w-4xl bg-black relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm gap-2">
              <Loader2 className="size-5 animate-spin" />
              Carregando vídeo…
            </div>
          )}
          <iframe
            src={src}
            title={title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setLoading(false)}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>
  );
}
