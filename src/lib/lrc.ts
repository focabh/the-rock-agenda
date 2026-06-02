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

/** Índice da linha "atual" para um instante (em segundos): a última cujo tempo
 *  já passou. Retorna -1 durante a introdução (antes do 1º verso). */
export function activeLineIndex(lines: LrcLine[], elapsedSec: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= elapsedSec) idx = i;
    else break;
  }
  return idx;
}
