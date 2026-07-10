// Busca RÁPIDA de metadados de música pra "Adicionar por nome". Usa a iTunes
// Search API (pública, grátis, sem chave): JSON pequeno e veloz (só título/
// artista/duração). A letra (LRCLIB) e o BPM entram em segundo plano DEPOIS de
// criar a música — pra a UI não travar. Não confundir com o LRCLIB search, que
// baixa a letra inteira de cada resultado (pesado/lento).

export type TrackHit = {
  titulo: string;
  artista: string;
  durationSec: number | null;
  artwork: string | null;
};

export async function searchTracks(query: string): Promise<TrackHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?media=music&entity=song&limit=15&term=${encodeURIComponent(q)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ trackName?: string; artistName?: string; trackTimeMillis?: number; artworkUrl60?: string }>;
    };
    const seen = new Set<string>();
    const out: TrackHit[] = [];
    for (const r of data.results ?? []) {
      const titulo = String(r.trackName ?? "").trim();
      const artista = String(r.artistName ?? "").trim();
      if (!titulo) continue;
      const key = `${titulo.toLowerCase()}|${artista.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        titulo,
        artista,
        durationSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
        artwork: r.artworkUrl60 ?? null,
      });
    }
    return out;
  } catch {
    return [];
  }
}
