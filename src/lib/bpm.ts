// Busca o BPM (andamento) de uma música na GetSongBPM. Grátis (precisa da
// GETSONGBPM_API_KEY no env) — exige crédito "BPM by GetSongBPM" no app.
// É estimativa da gravação original; a banda confirma com o Tap.

/** Tira sufixos que atrapalham a busca: "- Remastered 2021", "(2022 Remaster)", "- Live…". */
function limparTitulo(s: string): string {
  return s
    .replace(/\s*[-–]\s*(remaster|remastered|live|ao vivo|mono|stereo|version|edit|deluxe|bonus|anniversary|\d{4}).*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

export async function fetchBpm(titulo: string, artista?: string | null): Promise<number | null> {
  const key = process.env.GETSONGBPM_API_KEY;
  if (!key || !titulo) return null;
  const tit = limparTitulo(titulo) || titulo;
  // Com artista: casa título + artista. Sem artista (ex.: cover): só pelo título
  // — pega a versão "original"/mais conhecida.
  const lookup = artista ? `song:${tit} artist:${artista}` : `song:${tit}`;
  try {
    const r = await fetch(
      `https://api.getsong.co/search/?api_key=${key}&type=both&lookup=${encodeURIComponent(lookup)}`,
      { headers: { "User-Agent": "StageBoss/1.0 (+band app)" }, next: { revalidate: 86400 } }
    );
    if (!r.ok) return null;
    const data = (await r.json()) as { search?: { tempo?: string | number }[] };
    const arr = Array.isArray(data?.search) ? data.search : [];
    const t = arr.map((x) => Number(x?.tempo)).find((n) => Number.isFinite(n) && n > 0);
    if (!t) return null;
    return Math.max(30, Math.min(300, Math.round(t)));
  } catch {
    return null;
  }
}
