import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.18.69"],
  async headers() {
    return [
      {
        // Documentos HTML (páginas): nunca cachear, sempre buscar fresco.
        // Exclui /_next/ e arquivos estáticos (imagens, css, js, fontes),
        // que continuam com cache normal/imutável.
        source:
          "/((?!_next/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|woff|woff2|ttf)).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        // Service worker: sempre a versão mais nova, servido como JS.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
