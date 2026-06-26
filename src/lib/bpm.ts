// Busca o BPM (andamento) de uma música.
// Fonte primária: GetSongBPM (API oficial, grátis — precisa de GETSONGBPM_API_KEY
//   no env + crédito "BPM by GetSongBPM" no app).
// Fallback: songbpm.com (quando a primária não acha — comum em covers). O
//   songbpm.com lista as VERSÕES com o track id do Spotify, então quando temos
//   o spotifyTrackId casamos a versão exata.
// É sempre estimativa da gravação; a banda confirma com o Tap.

/** Tira sufixos que atrapalham a busca: "- Remastered 2021", "(2022 Remaster)", "- Live…". */
function limparTitulo(s: string): string {
  return s
    .replace(/\s*[-–]\s*(remaster|remastered|live|ao vivo|mono|stereo|version|edit|deluxe|bonus|anniversary|\d{4}).*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

function clampBpm(t: number | null | undefined): number | null {
  if (!t || !Number.isFinite(t) || t <= 0) return null;
  return Math.max(30, Math.min(300, Math.round(t)));
}

/** Fonte primária: API oficial GetSongBPM. */
async function fetchFromGetSongBpm(
  titulo: string,
  artista?: string | null
): Promise<number | null> {
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
    return clampBpm(t);
  } catch {
    return null;
  }
}

const SONGBPM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Content-Type": "application/x-www-form-urlencoded",
  // O POST de busca exige requisição de mesma-origem.
  Origin: "https://songbpm.com",
  Referer: "https://songbpm.com/",
};

type SongBpmCard = {
  artista: string;
  titulo: string;
  bpm: number | null;
  spotifyId: string | null;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseSongBpmCards(html: string): SongBpmCard[] {
  const cards: SongBpmCard[] = [];
  const re =
    /<a [^>]*href="(\/@[^"]+)"[\s\S]*?<\/a>\s*<div class="flex flex-row divide-x border-t">([\s\S]*?)<\/div>\s*<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const block = m[0];
    const ps = [...block.matchAll(/<p[^>]*>\s*([^<]+?)\s*<\/p>/g)].map((x) =>
      x[1].trim()
    );
    const bpmM = block.match(/>BPM<\/span>\s*<span[^>]*>\s*([0-9]{2,3})\s*</i);
    const spM = block.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
    cards.push({
      artista: ps[0] || "",
      titulo: ps[1] || "",
      bpm: bpmM ? Number(bpmM[1]) : null,
      spotifyId: spM ? spM[1] : null,
    });
  }
  return cards;
}

/** Fallback: songbpm.com. Casa a versão pelo spotifyTrackId quando dá. */
async function fetchFromSongBpm(
  titulo: string,
  artista?: string | null,
  spotifyTrackId?: string | null
): Promise<number | null> {
  if (!titulo) return null;
  const tit = limparTitulo(titulo) || titulo;
  const query = artista ? `${tit} ${artista}` : tit;
  try {
    const r = await fetch("https://songbpm.com/searches", {
      method: "POST",
      headers: SONGBPM_HEADERS,
      body: new URLSearchParams({ query }),
      redirect: "follow",
    });
    if (!r.ok) return null;
    const cards = parseSongBpmCards(await r.text()).filter((c) => c.bpm);
    if (cards.length === 0) return null;

    // 1) Versão exata pelo track id do Spotify.
    if (spotifyTrackId) {
      const exact = cards.find((c) => c.spotifyId === spotifyTrackId);
      if (exact) return clampBpm(exact.bpm);
    }

    // 2) Melhor casamento por artista + título (evita live/acústico se não pedido).
    const nTit = norm(tit);
    const nArt = artista ? norm(artista) : "";
    const queremosLive = /\b(live|ao vivo|ac(o|ó)ustic)\b/i.test(titulo);
    const score = (c: SongBpmCard) => {
      let s = 0;
      const ct = norm(c.titulo);
      const ca = norm(c.artista);
      if (nArt && (ca.includes(nArt) || nArt.includes(ca))) s += 4;
      if (ct === nTit) s += 3;
      else if (ct.includes(nTit) || nTit.includes(ct)) s += 1;
      if (!queremosLive && /\b(live|acoustic|remix|karaoke)\b/.test(ct)) s -= 2;
      return s;
    };
    const best = [...cards].sort((a, b) => score(b) - score(a))[0];
    return clampBpm(best.bpm);
  } catch {
    return null;
  }
}

/** Tonalidade (tom) via API oficial GetSongBPM — campo `key_of` (ex.: "Em",
 *  "Fm", "A"). É o tom da GRAVAÇÃO original; a banda ajusta se transpõe. Sem
 *  artista (cover), busca só pelo título (versão original). */
export async function fetchKey(
  titulo: string,
  artista?: string | null
): Promise<string | null> {
  const apiKey = process.env.GETSONGBPM_API_KEY;
  if (!apiKey || !titulo) return null;
  const tit = limparTitulo(titulo) || titulo;
  const lookup = artista ? `song:${tit} artist:${artista}` : `song:${tit}`;
  try {
    const r = await fetch(
      `https://api.getsong.co/search/?api_key=${apiKey}&type=both&lookup=${encodeURIComponent(lookup)}`,
      { headers: { "User-Agent": "StageBoss/1.0 (+band app)" }, next: { revalidate: 86400 } }
    );
    if (!r.ok) return null;
    const data = (await r.json()) as { search?: { key_of?: string }[] };
    const arr = Array.isArray(data?.search) ? data.search : [];
    const k = arr.map((x) => x?.key_of).find((v) => typeof v === "string" && v.trim());
    return k ? k.trim() : null;
  } catch {
    return null;
  }
}

/**
 * BPM de uma música: tenta a API oficial; se não achar, cai pro songbpm.com.
 * Passe o spotifyTrackId (quando houver) pra casar a versão exata no fallback.
 */
export async function fetchBpm(
  titulo: string,
  artista?: string | null,
  spotifyTrackId?: string | null
): Promise<number | null> {
  if (!titulo) return null;
  const primary = await fetchFromGetSongBpm(titulo, artista);
  if (primary) return primary;
  return fetchFromSongBpm(titulo, artista, spotifyTrackId);
}
