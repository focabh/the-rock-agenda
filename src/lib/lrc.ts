// Parser de LRC (letra sincronizada). Cada linha tem 1+ timestamps [mm:ss.xx].
// Usado pelo Inteliprompter pra rolar a letra no tempo real da música.

export type LrcLine = { t: number; text: string };

const STAMP = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;

/** Converte LRC em linhas ordenadas por tempo (em segundos). Mantém linhas
 *  vazias (marcam respiros/instrumental entre versos). */
export function parseLrc(lrc: string | null | undefined): LrcLine[] {
  if (!lrc) return [];
  const out: LrcLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    STAMP.lastIndex = 0;
    const stamps = [...raw.matchAll(STAMP)];
    if (stamps.length === 0) continue;
    const text = raw.replace(STAMP, "").trim();
    for (const m of stamps) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      // frações: [mm:ss.xx] (centésimos) ou [mm:ss.xxx] (milésimos)
      let frac = 0;
      if (m[3]) frac = Number(`0.${m[3]}`);
      out.push({ t: min * 60 + sec + frac, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export type Cue = { t: number; label: string };

/** Sugere marcações (intro + instrumentais longos) a partir dos vãos da letra
 *  sincronizada. Editável depois pelo usuário. */
export function suggestCues(lines: LrcLine[]): Cue[] {
  const v = lines.filter((l) => l.text);
  if (v.length === 0) return [];
  const cues: Cue[] = [];
  if (v[0].t > 8) cues.push({ t: 0, label: "Introdução" });
  for (let i = 0; i < v.length - 1; i++) {
    const gap = v[i + 1].t - v[i].t;
    if (gap > 12) {
      cues.push({ t: Math.round(v[i].t + Math.min(5, gap * 0.3)), label: "Instrumental" });
    }
  }
  return cues;
}

/** Parser tolerante do JSON de marcações guardado em songs.cues. */
export function parseCues(json: string | null | undefined): Cue[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => typeof c?.t === "number" && typeof c?.label === "string")
      .map((c) => ({ t: Math.max(0, Math.round(c.t)), label: String(c.label).slice(0, 60) }))
      .sort((a, b) => a.t - b.t);
  } catch {
    return [];
  }
}

export type TimelineEntry = { t: number; text: string; cue: boolean };

/** Junta versos (vocal) + marcações numa linha do tempo única, ordenada. */
export function buildTimeline(lines: LrcLine[], cues: Cue[]): TimelineEntry[] {
  const vocal = lines.filter((l) => l.text).map((l) => ({ t: l.t, text: l.text, cue: false }));
  const marks = cues.map((c) => ({ t: c.t, text: c.label, cue: true }));
  return [...vocal, ...marks].sort((a, b) => a.t - b.t);
}

/** Índice da linha "atual" para um instante (em segundos): a última cujo tempo
 *  já passou. Retorna -1 durante a introdução (antes do 1º verso). */
export function activeLineIndex(lines: { t: number }[], elapsedSec: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= elapsedSec) idx = i;
    else break;
  }
  return idx;
}
