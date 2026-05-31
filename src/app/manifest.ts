import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StageBoss",
    short_name: "StageBoss",
    description: "StageBoss — gestão de banda: shows, setlists, repertório e casas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    lang: "pt-BR",
    icons: [
      { src: "/api/icon/192", sizes: "192x192", purpose: "any" },
      { src: "/api/icon/512", sizes: "512x512", purpose: "any" },
      { src: "/api/icon/maskable", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
