// Ícones dinâmicos do PWA. Servem a logo enviada pelo admin (appSettings.logoUrl);
// se não houver, caem no PNG estático gerado no build. O manifest e o <head>
// apontam pra cá, então mudar a logo no Conta atualiza o ícone (precisa
// reinstalar o app na tela inicial pro iOS soltar o cache da logo antiga).

import { NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDataUrl(url: string): { mime: string; bytes: Buffer } | null {
  const m = url.match(/^data:([^;,]+);base64,(.+)$/);
  if (m) {
    return { mime: m[1], bytes: Buffer.from(m[2], "base64") };
  }
  const m2 = url.match(/^data:([^;,]+),(.+)$/);
  if (m2) {
    return { mime: m2[1], bytes: Buffer.from(decodeURIComponent(m2[2]), "utf8") };
  }
  return null;
}

const FALLBACK: Record<string, string> = {
  "192": "/icons/icon-192.png",
  "512": "/icons/icon-512.png",
  maskable: "/icons/icon-maskable.png",
  "180": "/icons/apple-touch-icon.png",
  apple: "/icons/apple-touch-icon.png",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;
  try {
    const [s] = await db
      .select({ url: appSettings.logoUrl })
      .from(appSettings)
      .limit(1);
    const url = s?.url;
    if (url && url.startsWith("data:")) {
      const parsed = parseDataUrl(url);
      if (parsed) {
        return new NextResponse(new Uint8Array(parsed.bytes), {
          headers: {
            "Content-Type": parsed.mime || "image/png",
            "Cache-Control": "public, max-age=300, must-revalidate",
          },
        });
      }
    }
  } catch {
    // segue pro fallback
  }
  const path = FALLBACK[size] ?? FALLBACK["192"];
  return NextResponse.redirect(new URL(path, req.url), 302);
}
