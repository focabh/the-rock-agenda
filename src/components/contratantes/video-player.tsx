"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { detectVideoEmbed } from "@/lib/video-embed";

/**
 * Player que evita o "flash escuro" do iframe inicial:
 * - YouTube: mostra a miniatura + botão play; só carrega o iframe quando clicar.
 * - Vimeo / Drive: iframe com loading="lazy".
 * - Outros: nada (o caller mostra link clicável).
 */
export function VideoPlayer({ url, title }: { url: string; title: string }) {
  const embed = detectVideoEmbed(url);
  const [active, setActive] = useState(false);

  if (embed.kind !== "embed") return null;

  if (embed.provider === "youtube") {
    const id = embed.src.match(/embed\/([\w-]{11})/)?.[1];
    if (id && !active) {
      // hqdefault funciona pra praticamente todo vídeo; é leve.
      const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="block aspect-video w-full bg-black relative group focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={`Reproduzir ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
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
    return (
      <div className="aspect-video bg-black">
        <iframe
          src={`${embed.src}?autoplay=1`}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  // Vimeo / Drive: lazy
  return (
    <div className="aspect-video bg-black">
      <iframe
        src={embed.src}
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
