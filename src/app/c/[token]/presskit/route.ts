// Serve o press kit em separado pro iframe da página pública.
// Valida token (não revogado, não expirado), pega o item presskit do
// promo_items, e devolve os bytes (se data URL) ou redireciona (se link).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contractorLinks, promoItems } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDataUrl(url: string): { mime: string; bytes: Buffer } | null {
  const m = url.match(/^data:([^;,]+);base64,(.+)$/);
  if (m) return { mime: m[1], bytes: Buffer.from(m[2], "base64") };
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const [link] = await db
    .select()
    .from(contractorLinks)
    .where(eq(contractorLinks.token, token))
    .limit(1);
  if (!link) return new NextResponse("Não encontrado.", { status: 404 });
  if (link.revokedEm)
    return new NextResponse("Link revogado.", { status: 410 });
  if (link.expiresEm.getTime() < Date.now())
    return new NextResponse("Link expirado.", { status: 410 });

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
        "Content-Disposition": "inline; filename=\"presskit\"",
        "Cache-Control": "private, max-age=300",
      },
    });
  }
  // Link externo (Drive, Dropbox etc.): redireciona.
  return NextResponse.redirect(url, 302);
}
