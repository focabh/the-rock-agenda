"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { detectVideoEmbed } from "@/lib/video-embed";

/**
 * Player que evita o "flash escuro" do iframe inicial:
 * - Com capa custom (qualquer provedor): mostra a capa + botão play; o iframe
 *   só carrega quando clica. Visual bem mais bonito que a thumb padrão.
 * - YouTube sem capa: usa a miniatura oficial do vídeo.
 * - Vimeo / Drive sem capa: iframe com loading="lazy".
 * - Outros: nada (o caller mostra link clicável).
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

  // Quando há capa, usamos o lite-pattern com a capa pra QUALQUER provedor.
  if (cover && !active) {
    return <CoverPlay cover={cover} title={title} onPlay={() => setActive(true)} />;
  }

  if (embed.provider === "youtube") {
    const id = embed.src.match(/embed\/([\w-]{11})/)?.[1];
    if (id && !active) {
      const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return (
        <CoverPlay
          cover={thumb}
          title={title}
          onPlay={() => setActive(true)}
        />
      );
    }
    if (active) {
      // controls=0: sem barra de play/seek; modestbranding+rel=0+iv_load=3:
      // sem sugestões nem branding; playsinline pra iOS não abrir fullscreen.
      const src = `${embed.src}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`;
      return (
        <div className="aspect-video bg-black">
          <iframe
            src={src}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
  }

  // Vimeo: parâmetros equivalentes pra esconder UI.
  // Drive: o player do Drive não suporta esses params; segue padrão.
  let src = embed.src;
  if (active) {
    if (embed.provider === "vimeo") {
      src = `${embed.src}?autoplay=1&title=0&byline=0&portrait=0&controls=0`;
    } else {
      src = `${embed.src}?autoplay=1`;
    }
  }

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
      className="block aspect-video w-full bg-black relative group focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={`Reproduzir ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt={title}
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="size-16 rounded-full bg-red-600/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <Play className="size-7 text-white fill-white ml-1" />
        </span>
      </span>
    </button>
  );
}
