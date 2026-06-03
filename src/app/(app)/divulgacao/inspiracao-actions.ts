"use server";

import { requireAdmin } from "@/lib/auth";

export type RefImg = { id: string; thumb: string; source: string; title: string; creator: string | null };

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
