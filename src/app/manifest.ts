import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Rock — Backstage",
    short_name: "The Rock",
    description: "Agenda, ensaios, repertório e bastidores da banda The Rock.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#171717",
    theme_color: "#171717",
    lang: "pt-BR",
    icons: [
      { src: "/api/icon/192", sizes: "192x192", purpose: "any" },
      { src: "/api/icon/512", sizes: "512x512", purpose: "any" },
      { src: "/api/icon/maskable", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
