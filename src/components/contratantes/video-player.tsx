"use client";

import { Play } from "lucide-react";
import { detectVideoEmbed } from "@/lib/video-embed";

/**
 * Tocar na capa abre o vídeo direto no provider (Drive/YouTube/Vimeo).
 * Sem modal, sem iframe interno — performance máxima, controles nativos.
 * Fechar lá → o navegador volta pra esta aba.
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
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block aspect-video w-full bg-black relative group overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={`Assistir ${title}`}
    >
      <CoverInner cover={showCover} title={title} />
    </a>
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
