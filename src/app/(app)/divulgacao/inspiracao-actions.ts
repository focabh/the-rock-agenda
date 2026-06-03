"use server";

import { requireAdmin } from "@/lib/auth";

export type RefImg = { id: string; thumb: string; url: string; source: string; title: string; creator: string | null };

// Busca referências visuais de cartazes/flyers na web pra inspiração.
// Usa a API do Openverse (imagens Creative Commons) — SEM chave e SEM IA,
// então não gasta token. As imagens são de terceiros, só pra inspirar.
export async function buscarReferenciasFlyerAction(
  query: string
): Promise<{ items?: RefImg[]; error?: string }> {
  await requireAdmin();
  const q = (query || "concert gig poster band").trim().slice(0, 80);
  try {
    const url =
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}` +
      `&page_size=18&mature=false`;
    const r = await fetch(url, {
      headers: { "User-Agent": "StageBoss/1.0 (+band management app)", Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!r.ok) return { error: "Não consegui buscar agora — tente de novo em instantes." };
    const data = (await r.json()) as {
      results?: { id: string; thumbnail?: string; url?: string; foreign_landing_url?: string; title?: string; creator?: string }[];
    };
    const items: RefImg[] = (data.results ?? [])
      .filter((x) => x.thumbnail || x.url)
      .map((x) => ({
        id: x.id,
        thumb: (x.thumbnail || x.url)!,
        url: (x.url || x.thumbnail)!,
        source: x.foreign_landing_url || x.url || "",
        title: x.title ?? "",
        creator: x.creator ?? null,
      }));
    if (items.length === 0) return { error: "Nada encontrado. Tente outras palavras (ex.: 'rock gig poster')." };
    return { items };
  } catch {
    return { error: "Falha ao buscar inspiração. Verifique a conexão e tente de novo." };
  }
}

// Baixa a imagem escolhida (no servidor, contornando CORS) e devolve como data
// URL, pra usar de fundo do flyer e poder exportar sem erro. Cap de ~8MB.
export async function importarReferenciaAction(
  imageUrl: string
): Promise<{ dataUrl?: string; error?: string }> {
  await requireAdmin();
  if (!/^https?:\/\//i.test(imageUrl)) return { error: "Imagem inválida." };
  try {
    const r = await fetch(imageUrl, { headers: { "User-Agent": "StageBoss/1.0 (+band app)" } });
    if (!r.ok) return { error: "Não consegui baixar essa imagem. Tente outra." };
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return { error: "O link não é uma imagem." };
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 8_000_000) return { error: "Imagem muito grande. Escolha outra." };
    const base64 = Buffer.from(buf).toString("base64");
    return { dataUrl: `data:${type};base64,${base64}` };
  } catch {
    return { error: "Falha ao importar a imagem." };
  }
}
