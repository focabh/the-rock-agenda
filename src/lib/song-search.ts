// Busca de metadados de música pra "Adicionar por nome".
//
// Fonte: iTunes Search API (pública, grátis, sem chave) — JSON pequeno e veloz
// (título/artista/duração). A letra (LRCLIB) e o BPM entram DEPOIS, em segundo
// plano, ao criar a música (não travam a UI).
//
// Por que não é só um /search: o /search do iTunes rankeia mal — pra
// "creep radiohead" devolve acústico/cover/karaokê e NÃO mostra o estúdio
// original (que existe no catálogo, em Pablo Honey). Estratégia:
//   1) /search pelo termo inteiro (rápido);
//   2) se o texto parece "música + artista", RESOLVE o artista e puxa o
//      catálogo oficial dele, mesclando;
//   3) rankeia tudo por uma função PURA (scoreTrack/rankTracks) — versões não
//      pedidas (acústico/live/remix/karaokê/cover/tributo/instrumental) levam
//      penalidade; a versão EXPLICITAMENTE pedida ("creep acoustic") é
//      priorizada.
// A expansão de catálogo tem timeout e degrada pros resultados normais se
// demorar/falhar. Cache com TTL + limite evita repetir chamadas e crescer sem
// controle. Ver README de ranking/cache no fim do arquivo.

export type TrackHit = {
  titulo: string;
  artista: string;
  durationSec: number | null;
  artwork: string | null;
};

type RawTrack = {
  trackName?: string;
  artistName?: string;
  artistId?: number;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl60?: string;
};

// ---------------------------------------------------------------------------
// Normalização — minúsculas, sem acento, pontuação vira espaço. Faz "AC/DC" →
// "ac dc", "R.E.M." → "r e m", "Guns N' Roses" → "guns n roses". Assim
// apóstrofo/acento/pontuação não atrapalham a identificação do artista (#3).
// ---------------------------------------------------------------------------
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const wordsOf = (s: string) => norm(s).split(" ").filter(Boolean);

// ---------------------------------------------------------------------------
// Variantes "não originais". Detecção por LIMITE DE PALAVRA (\b) — crucial:
// includes("live") marcaria "Alive" como ao vivo (e quebraria "alive pearl
// jam"). Com \blive\b, "alive" NÃO casa. Idem cover/discover, demo/democracia.
// ---------------------------------------------------------------------------
const VARIANTS: { key: string; kw: string[]; alsoArtist?: boolean }[] = [
  { key: "acoustic", kw: ["acoustic", "acustico", "acustica", "unplugged"] },
  { key: "live", kw: ["live", "ao vivo", "en vivo"] },
  { key: "remix", kw: ["remix", "rmx", "mix"] },
  { key: "karaoke", kw: ["karaoke"], alsoArtist: true },
  { key: "cover", kw: ["cover"], alsoArtist: true },
  { key: "tribute", kw: ["tribute", "tributo", "made famous", "originally performed", "in the style of"], alsoArtist: true },
  { key: "instrumental", kw: ["instrumental"], alsoArtist: true },
  { key: "demo", kw: ["demo"] },
  { key: "edit", kw: ["sped up", "slowed"] },
];

const wordRe = (kw: string) => new RegExp(`\\b${kw.replace(/\s+/g, "\\s")}\\b`);

function hasVariant(text: string, kws: string[]): boolean {
  const n = norm(text);
  return kws.some((kw) => wordRe(kw).test(n));
}

/** Categorias de variante que a query PEDE explicitamente (ex.: usuário digitou
 *  "acoustic"). Nessas, a gente NÃO penaliza — priorizamos essa versão. */
export function requestedVariants(query: string): Set<string> {
  const out = new Set<string>();
  for (const v of VARIANTS) if (hasVariant(query, v.kw)) out.add(v.key);
  return out;
}

/** Categorias que ESTA faixa apresenta (título+álbum; e artista pra
 *  karaokê/cover/tributo/instrumental — "Karaoke Band" etc). */
function trackVariants(t: RawTrack): Set<string> {
  const tc = `${t.trackName ?? ""} ${t.collectionName ?? ""}`;
  const ar = t.artistName ?? "";
  const out = new Set<string>();
  for (const v of VARIANTS) {
    if (hasVariant(tc, v.kw) || (v.alsoArtist && hasVariant(ar, v.kw))) out.add(v.key);
  }
  return out;
}

/** O nome do artista aparece como FRASE inteira dentro da query? Usa limite de
 *  palavra normalizado — "Queen" NÃO casa "queens", mas "R.E.M." casa "r e m".
 *  Base da resolução conservadora de artista (#2/#3). */
export function artistNameMatchesQuery(query: string, artistName: string): boolean {
  const nq = ` ${norm(query)} `;
  const na = norm(artistName);
  if (na.length < 2) return false;
  // Casa o nome inteiro OU sem o "the" inicial ("cranberries" p/ "The
  // Cranberries", "killers" p/ "The Killers").
  const variants = [na, na.replace(/^the /, "")];
  return variants.some((v) => v.length >= 2 && nq.includes(` ${v} `));
}

// ---------------------------------------------------------------------------
// RANKING — função PURA e testável. Sinais formalizados (todos somados):
//   +8  faixa veio do catálogo OFICIAL do artista resolvido (fromCatalog)
//   +5  artista bate exatamente com o texto digitado (artistNameMatchesQuery)
//   +5·cobertura  palavras "núcleo" (query − artista − variantes) no título
//   +3  título "limpo" (sem parênteses/colchetes) — só quando NÃO se pediu variante
//   +6  a faixa TEM uma variante que foi pedida (ex.: "acoustic" pedido)
//   -20 a faixa tem uma variante que NÃO foi pedida
//   -10 pediram uma variante que esta faixa NÃO tem
//   -2  remaster (quase sempre canônico → penalidade leve)
//   -0.1·índice  desempate estável (preserva um pouco da ordem de origem)
// Popularidade: iTunes /search não expõe sinal confiável → não usado (N/A).
// ---------------------------------------------------------------------------
export function scoreTrack(
  t: RawTrack,
  ctx: { query: string; coreWords: string[]; requested: Set<string>; fromCatalog: boolean; index: number }
): number {
  const nTitle = norm(t.trackName ?? "");
  let score = -ctx.index * 0.1;

  const vars = trackVariants(t);
  for (const v of vars) score += ctx.requested.has(v) ? 6 : -20;
  for (const v of ctx.requested) if (!vars.has(v)) score -= 10;

  if (/\bremaster/.test(nTitle)) score -= 2;
  if (artistNameMatchesQuery(ctx.query, t.artistName ?? "")) score += 5;

  if (ctx.coreWords.length) {
    const hit = ctx.coreWords.filter((w) => new RegExp(`\\b${w}\\b`).test(nTitle)).length;
    score += 5 * (hit / ctx.coreWords.length);
  }

  if (ctx.requested.size === 0 && !/[([]/.test(t.trackName ?? "")) score += 3;
  if (ctx.fromCatalog) score += 8;
  return score;
}

function toHit(t: RawTrack): TrackHit {
  return {
    titulo: String(t.trackName ?? "").trim(),
    artista: String(t.artistName ?? "").trim(),
    durationSec: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : null,
    artwork: t.artworkUrl60 ?? null,
  };
}

/** Mescla catálogo + /search, pontua, deduplica (melhor versão por
 *  título+artista) e ordena. PURA — sem rede. Testável com fixtures. */
export function rankTracks(
  query: string,
  opts: { song: RawTrack[]; catalog?: RawTrack[]; artistNames?: string[] }
): TrackHit[] {
  const requested = requestedVariants(query);
  const artistWords = new Set((opts.artistNames ?? []).flatMap(wordsOf));
  const variantWords = new Set(VARIANTS.flatMap((v) => v.kw).flatMap(wordsOf));
  // "Núcleo": palavras da query que provavelmente são o TÍTULO (tira artista e
  // termos de variante). Diferencia "Black" de "Alive" num mesmo artista.
  const coreWords = wordsOf(query).filter(
    (w) => w.length > 1 && !artistWords.has(w) && !variantWords.has(w)
  );

  type Scored = { hit: TrackHit; score: number };
  const seen = new Map<string, Scored>();
  const consider = (list: RawTrack[], fromCatalog: boolean) => {
    list.forEach((t, index) => {
      const titulo = String(t.trackName ?? "").trim();
      if (!titulo) return;
      const hit = toHit(t);
      const score = scoreTrack(t, { query, coreWords, requested, fromCatalog, index });
      const key = `${norm(hit.titulo)}|${norm(hit.artista)}`;
      const prev = seen.get(key);
      if (!prev || score > prev.score) seen.set(key, { hit, score });
    });
  };
  consider(opts.catalog ?? [], true);
  consider(opts.song, false);

  return [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((s) => s.hit);
}

// ---------------------------------------------------------------------------
// Cache — TTL + limite. Chave: `catalog:<artistId>`. TTL 10 min, máx 300
// entradas (evict do mais antigo/LRU). Armazenamento: memória do PROCESSO.
// No Vercel isso é POR INSTÂNCIA serverless (não compartilha entre instâncias e
// zera no cold start) — é best-effort só pra aliviar a digitação; não guarda
// nada sensível e não cresce sem controle. Invalidação: só por TTL/limite.
// Falha transitória de rede NÃO é cacheada (não envenena resultados).
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;

class TtlCache<V> {
  private m = new Map<string, { v: V; exp: number }>();
  get(k: string): V | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.m.delete(k);
      return undefined;
    }
    // renova ordem de recência
    this.m.delete(k);
    this.m.set(k, e);
    return e.v;
  }
  set(k: string, v: V) {
    if (this.m.size >= CACHE_MAX) {
      const oldest = this.m.keys().next().value;
      if (oldest !== undefined) this.m.delete(oldest);
    }
    this.m.set(k, { v, exp: Date.now() + CACHE_TTL_MS });
  }
}

type Artist = { id: number; name: string };
let catalogCache = new TtlCache<RawTrack[]>();

/** Só pra testes: zera o cache de processo entre casos. */
export function _resetSearchCaches() {
  catalogCache = new TtlCache<RawTrack[]>();
}

// ---------------------------------------------------------------------------
// IO — cada fetch com timeout próprio (AbortController) pra nunca pendurar.
// Chamadas ao iTunes por busca: 1 (/search) + no máx 2 (lookup de catálogo).
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 2500;
const CATALOG_BUDGET_MS = 2500; // teto pra toda a expansão de catálogo
const MAX_ARTISTS = 2;

async function itunes<T = { results?: RawTrack[] }>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function artistCatalog(id: number): Promise<RawTrack[] | null> {
  const cached = catalogCache.get(`catalog:${id}`);
  if (cached !== undefined) return cached;
  const data = await itunes(`https://itunes.apple.com/lookup?id=${id}&entity=song&limit=200`);
  if (data === null) return null; // falha transitória → não cacheia
  const tracks = (data.results ?? []).filter((r) => r.trackName) as RawTrack[];
  catalogCache.set(`catalog:${id}`, tracks);
  return tracks;
}

type Expansion = { artists: Artist[]; tracks: RawTrack[] };

/** Descobre o(s) artista(s) reais A PARTIR dos resultados da busca (que já
 *  trazem artistId) e traz o catálogo oficial deles — assim o estúdio original,
 *  que o /search esconde, aparece. Conservador: só usa artistas que (a)
 *  aparecem nos resultados E (b) casam com a query como frase (limite de
 *  palavra). Isso mata o homônimo (artista "Creep") sem chamada extra de rede.
 *  Filtra features de terceiros. Nunca joga — vazio em qualquer falha. */
async function expandCatalog(query: string, songResults: RawTrack[]): Promise<Expansion> {
  const qWords = wordsOf(query);
  const cand = new Map<number, string>();
  for (const t of songResults) {
    if (typeof t.artistId === "number" && t.artistName && artistNameMatchesQuery(query, t.artistName)) {
      if (!cand.has(t.artistId)) cand.set(t.artistId, t.artistName);
    }
  }
  const artists: Artist[] = [...cand.entries()].slice(0, MAX_ARTISTS).map(([id, name]) => ({ id, name }));
  const perArtist = await Promise.all(
    artists.map(async (a) => {
      const nameWords = new Set(wordsOf(a.name));
      const tracks = (await artistCatalog(a.id)) ?? [];
      return tracks.filter((t) => {
        if (!artistNameMatchesQuery(a.name, t.artistName ?? "")) return false; // só faixas DELE
        const tl = norm(t.trackName ?? "");
        return qWords.some(
          (w) => w.length > 1 && !nameWords.has(w) && new RegExp(`\\b${w}\\b`).test(tl)
        );
      });
    })
  );
  return { artists, tracks: perArtist.flat() };
}

const songSearchUrl = (q: string) =>
  `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${encodeURIComponent(q)}`;

/** FASE 1 — só a busca normal do iTunes, rankeada. RÁPIDA (uma chamada). É o que
 *  aparece na hora; a expansão de catálogo (searchTracks) refina depois SEM
 *  bloquear a exibição destes resultados. */
export async function searchTracksFast(query: string): Promise<TrackHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const songData = await itunes(songSearchUrl(q));
  return rankTracks(q, { song: (songData?.results ?? []) as RawTrack[] });
}

/** FASE 2 (completa) — busca normal + expansão de catálogo do artista. Pode
 *  demorar mais (lookup do iTunes); por isso roda como REFINO por cima da
 *  fase 1, nunca no caminho crítico da primeira exibição. */
export async function searchTracks(query: string): Promise<TrackHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const qWords = wordsOf(q);

  // (1) Busca normal — base essencial (o /search já traz artistId).
  const songData = await itunes(songSearchUrl(q));
  const song = (songData?.results ?? []) as RawTrack[];

  // (2) Expansão de catálogo — só quando parece "música + artista" (2+ palavras).
  //     Tem teto de tempo: se estourar/falhar, DEGRADA pros resultados normais
  //     (a expansão nunca impede a exibição da busca normal).
  const empty: Expansion = { artists: [], tracks: [] };
  const expand =
    qWords.length >= 2 && song.length > 0
      ? await withTimeout(expandCatalog(q, song), CATALOG_BUDGET_MS, empty)
      : empty;

  return rankTracks(q, {
    song,
    catalog: expand.tracks,
    artistNames: expand.artists.map((a) => a.name),
  });
}
