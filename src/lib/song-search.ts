// Busca RÁPIDA de metadados de música pra "Adicionar por nome". Usa a iTunes
// Search API (pública, grátis, sem chave): JSON pequeno e veloz (só título/
// artista/duração). A letra (LRCLIB) e o BPM entram em segundo plano DEPOIS de
// criar a música — pra a UI não travar. Não confundir com o LRCLIB search, que
// baixa a letra inteira de cada resultado (pesado/lento).
//
// Por que não é só um /search: o /search do iTunes rankeia mal — pra "creep
// radiohead" ele devolve acústico/cover/karaokê e NÃO mostra o estúdio original
// (que existe no catálogo em "Pablo Honey"). Então, quando o texto parece
// "música + artista", a gente também RESOLVE o artista e puxa o catálogo dele,
// mesclando. Aí o original aparece e sobe no rank (versões "não originais" levam
// penalidade). Tudo com limite de chamadas + cache pra não estourar rate limit.

export type TrackHit = {
  titulo: string;
  artista: string;
  durationSec: number | null;
  artwork: string | null;
};

type RawTrack = {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl60?: string;
};

// Versões "não originais" que o iTunes gosta de jogar pra cima. Penalizadas no
// rank pra a versão de estúdio original vir primeiro — que é o que a banda toca
// e o que casa com a letra/tempo sincronizados.
const JUNK_TITLE = [
  "acoustic", "acústic", "live", "ao vivo", "remix", " rmx", "karaoke",
  "karaokê", "instrumental", "cover", "tribute", "tributo", "made famous",
  "originally performed", "in the style of", "reimagined", "rerecorded",
  "re-recorded", "demo", "sped up", "slowed",
];

const JUNK_ARTIST = [
  "karaoke", "karaokê", "tribute", "tributo", "made famous",
  "originally performed", "in the style of", "string quartet", "cover band",
  "the hit crew", "hit makers",
];

const hasAny = (hay: string, needles: string[]) => needles.some((n) => hay.includes(n));

type Artist = { id: number; name: string };

// Cache de processo (curto) pra não repetir chamadas ao iTunes durante a
// digitação. Some quando o server reinicia — não precisa persistir.
const artistCache = new Map<string, Artist | null>();
const catalogCache = new Map<number, RawTrack[]>();

async function itunes<T = { results?: RawTrack[] }>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Resolve o artista do iTunes pra uma palavra, se ela nomear um artista cujo
 *  nome cabe dentro da query (ex.: "radiohead" → Radiohead). Cacheado. */
async function resolveArtist(word: string, queryWords: Set<string>): Promise<Artist | null> {
  if (artistCache.has(word)) return artistCache.get(word)!;
  const data = await itunes<{ results?: Array<{ artistId?: number; artistName?: string }> }>(
    `https://itunes.apple.com/search?media=music&entity=musicArtist&limit=1&term=${encodeURIComponent(word)}`
  );
  const a = data?.results?.[0];
  let out: Artist | null = null;
  if (a?.artistId && a.artistName) {
    // Aceita só se o nome do artista é um subconjunto das palavras digitadas —
    // evita puxar um artista aleatório que o iTunes devolveu por engano.
    const nameWords = a.artistName.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (nameWords.length && nameWords.every((w) => queryWords.has(w))) {
      out = { id: a.artistId, name: a.artistName };
    }
  }
  artistCache.set(word, out);
  return out;
}

async function artistCatalog(id: number): Promise<RawTrack[]> {
  if (catalogCache.has(id)) return catalogCache.get(id)!;
  const data = await itunes(`https://itunes.apple.com/lookup?id=${id}&entity=song&limit=200`);
  // O primeiro result é o próprio artista; os demais são as faixas.
  const tracks = (data?.results ?? []).filter((r) => r.trackName) as RawTrack[];
  catalogCache.set(id, tracks);
  return tracks;
}

function scoreTrack(r: RawTrack, i: number, qWords: string[], fromArtist: boolean): number {
  const tl = String(r.trackName ?? "").toLowerCase();
  const al = String(r.artistName ?? "").toLowerCase();
  const cl = String(r.collectionName ?? "").toLowerCase();
  let score = -i * 0.1; // desempate: preserva um pouco da ordem de origem
  if (hasAny(tl, JUNK_TITLE)) score -= 20;
  if (hasAny(al, JUNK_ARTIST)) score -= 30;
  if (hasAny(cl, ["karaoke", "karaokê", "tribute", "tributo", "instrumental"])) score -= 20;
  if (/remaster/.test(tl)) score -= 2; // remaster é quase sempre canônico → só de leve
  for (const w of qWords) if (al.includes(w)) score += 4; // artista bate com o digitado
  if (!/[([]/.test(String(r.trackName ?? ""))) score += 3; // título "limpo"
  if (fromArtist) score += 8; // veio do catálogo do artista certo → provável original
  return score;
}

export async function searchTracks(query: string): Promise<TrackHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const qWords = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const qWordSet = new Set(qWords);

  // 1) Busca de música pelo termo inteiro (rápida).
  const songReq = itunes(
    `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${encodeURIComponent(q)}`
  );

  // 2) Se parece "música + artista" (2+ palavras), tenta resolver artistas por
  //    palavra e puxar o catálogo — assim o estúdio original aparece mesmo
  //    quando o /search o esconde. Limitado a 4 palavras + 2 artistas.
  let catalogTracks: RawTrack[] = [];
  if (qWords.length >= 2) {
    const artists = (
      await Promise.all(qWords.slice(0, 4).map((w) => resolveArtist(w, qWordSet)))
    ).filter((x): x is Artist => x != null);
    // Dedupe por id, no máximo 2 artistas.
    const uniq = [...new Map(artists.map((a) => [a.id, a])).values()].slice(0, 2);
    const perArtist = await Promise.all(
      uniq.map(async (a) => {
        const nameWords = a.name.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
        const tracks = await artistCatalog(a.id);
        // Só faixas DO artista resolvido (não features de terceiros no catálogo
        // dele) cujo título casa com uma palavra que não é o nome do artista.
        return tracks.filter((t) => {
          const tl = String(t.trackName ?? "").toLowerCase();
          const al = String(t.artistName ?? "").toLowerCase();
          const isThisArtist = nameWords.some((w) => al.includes(w));
          return isThisArtist && qWords.some((w) => tl.includes(w) && !al.includes(w));
        });
      })
    );
    catalogTracks = perArtist.flat();
  }

  const songResults = ((await songReq)?.results ?? []) as RawTrack[];

  // Mescla, pontua e deduplica (mantém a melhor versão por título+artista).
  type Scored = TrackHit & { score: number };
  const seen = new Map<string, Scored>();
  const add = (r: RawTrack, i: number, fromArtist: boolean) => {
    const titulo = String(r.trackName ?? "").trim();
    const artista = String(r.artistName ?? "").trim();
    if (!titulo) return;
    const hit: Scored = {
      titulo,
      artista,
      durationSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
      artwork: r.artworkUrl60 ?? null,
      score: scoreTrack(r, i, qWords, fromArtist),
    };
    const key = `${titulo.toLowerCase()}|${artista.toLowerCase()}`;
    const prev = seen.get(key);
    if (!prev || hit.score > prev.score) seen.set(key, hit);
  };
  catalogTracks.forEach((r, i) => add(r, i, true));
  songResults.forEach((r, i) => add(r, i, false));

  return [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ score: _score, ...hit }) => hit);
}
