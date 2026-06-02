/**
 * Busca de letra via LRCLIB (https://lrclib.net) — API pública, grátis, sem
 * chave. Retorna a letra simples (texto puro). Usado só pra cachear na 1ª
 * abertura; depois a letra fica no banco e pode ser corrigida pelo admin.
 *
 * Nota: letras são protegidas por direitos autorais. Uso aqui é interno da
 * banda (estudo/ensaio). LRCLIB é a mesma fonte usada por vários players open
 * source.
 */

const UA = "TheRock/1.0 (https://therockbh.vercel.app; band rehearsal app)";

/** Tira sufixos de versão que atrapalham o match: "- Remastered 2014", "(2022 Remaster)", "- Live". */
export function cleanTrackTitle(t: string): string {
  return t
    .replace(/\s*-\s*(remaster|remastered|ao vivo|live|mono|stereo|single version).*/i, "")
    .replace(/\s*\((?:[^)]*\b(?:remaster|remastered|live|ao vivo|mono|version)\b[^)]*)\)/i, "")
    .trim();
}

type LrclibTrack = {
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  instrumental?: boolean;
  duration?: number | null; // segundos (pode ser float)
};

export type LyricsHit = {
  plain: string | null;
  synced: string | null; // LRC (timestamps por linha) — alimenta o Inteliprompter
  durationSec: number | null;
};

const EMPTY: LyricsHit = { plain: null, synced: null, durationSec: null };

function pick(d: LrclibTrack): LyricsHit {
  return {
    plain: d.plainLyrics?.trim() || null,
    synced: d.syncedLyrics?.trim() || null,
    durationSec: typeof d.duration === "number" && d.duration > 0 ? Math.round(d.duration) : null,
  };
}

/** Busca letra (simples + sincronizada) e duração no LRCLIB. */
export async function fetchLyricsFull(titulo: string, artista: string): Promise<LyricsHit> {
  const title = cleanTrackTitle(titulo);

  // 1) match exato por artista + título
  try {
    const res = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artista)}&track_name=${encodeURIComponent(title)}`,
      { headers: { "User-Agent": UA }, cache: "no-store" }
    );
    if (res.ok) {
      const d = (await res.json()) as LrclibTrack;
      if ((d.plainLyrics && d.plainLyrics.trim()) || (d.syncedLyrics && d.syncedLyrics.trim())) {
        return pick(d);
      }
    }
  } catch {
    // ignora — tenta a busca fuzzy
  }

  // 2) busca fuzzy — prioriza um resultado COM sincronizada; senão, com simples.
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artista}`)}`,
      { headers: { "User-Agent": UA }, cache: "no-store" }
    );
    if (res.ok) {
      const arr = (await res.json()) as LrclibTrack[];
      const hit =
        arr.find((x) => x.syncedLyrics && x.syncedLyrics.trim()) ||
        arr.find((x) => x.plainLyrics && x.plainLyrics.trim());
      if (hit) return pick(hit);
    }
  } catch {
    // ignora
  }

  return EMPTY;
}

/** Compat: só a letra simples. */
export async function fetchLyrics(titulo: string, artista: string): Promise<string | null> {
  return (await fetchLyricsFull(titulo, artista)).plain;
}
