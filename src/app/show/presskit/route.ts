// Serve o press kit pro iframe da página fixa /show.
// Sem validação de token (link único pra todos os contratantes).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { promoItems } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDataUrl(url: string): { mime: string; bytes: Buffer } | null {
  const m = url.match(/^data:([^;,]+);base64,(.+)$/);
  if (m) return { mime: m[1], bytes: Buffer.from(m[2], "base64") };
  return null;
}

export async function GET() {
  const [presskit] = await db
    .select()
    .from(promoItems)
    .where(eq(promoItems.tipo, "presskit"))
    .limit(1);
  if (!presskit) {
    return new NextResponse("Press kit ainda não disponível.", { status: 404 });
  }

  const url = presskit.url;
  if (url.startsWith("data:")) {
    const parsed = parseDataUrl(url);
    if (!parsed) return new NextResponse("Press kit inválido.", { status: 500 });
    return new NextResponse(new Uint8Array(parsed.bytes), {
      headers: {
        "Content-Type": parsed.mime || "application/pdf",
        "Content-Disposition": 'inline; filename="presskit"',
        "Cache-Control": "private, max-age=300",
      },
    });
  }
  // Link externo (Drive, Dropbox etc.): redireciona.
  return NextResponse.redirect(url, 302);
}
