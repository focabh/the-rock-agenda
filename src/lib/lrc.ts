// Parser de LRC (letra sincronizada). Cada linha tem 1+ timestamps [mm:ss.xx].
// Usado pelo Inteliprompter pra rolar a letra no tempo real da música.

export type LrcLine = { t: number; text: string };

const STAMP = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;
// Tag de ajuste global do LRC: [offset:+/-ms]. Muitos arquivos trazem isso e,
// sem aplicar, a letra fica sistematicamente adiantada/atrasada.
const OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i;

/** Converte LRC em linhas ordenadas por tempo (em segundos). Mantém linhas
 *  vazias (marcam respiros/instrumental entre versos). Aplica a tag [offset:]. */
export function parseLrc(lrc: string | null | undefined): LrcLine[] {
  if (!lrc) return [];
  // Convenção LRC: offset positivo = letra aparece MAIS CEDO → subtrai do tempo.
  const offMatch = lrc.match(OFFSET_TAG);
  const offsetSec = offMatch ? Number(offMatch[1]) / 1000 : 0;
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
      out.push({ t: Math.max(0, min * 60 + sec + frac - offsetSec), text });
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

// ---------------- AVISOS DE ENTRADA VOCAL (teleprompter) ----------------
// "Não me avise sobre tudo. Só me avise quando eu posso perder a entrada."
export type AlertMode = "ensaio" | "show" | "limpo";
export type EntryWarning = {
  shouldShowWarning: boolean;
  warningText: string;
  warningType: "vocal_entry" | null;
};

export const ALERT_DEFAULTS = {
  // só conta nos últimos N segundos antes do vocal
  entryWarningThresholdSeconds: 8,
  // vão instrumental mínimo (intro/solo/ponte/break) pra justificar aviso
  minimumInstrumentalGapSeconds: 10,
  // mostra "Prepare a entrada" antes da contagem (padrão: não)
  showPrepareMessageBeforeCountdown: false,
  // no modo Ensaio, vão mínimo pra mostrar (mais informativo)
  ensaioGapSeconds: 6,
};

const NO_WARNING: EntryWarning = { shouldShowWarning: false, warningText: "", warningType: null };

/** Decide, de forma centralizada, se o teleprompter deve mostrar um aviso de
 *  entrada vocal — e qual texto. Discreto por padrão (modo "show"):
 *  só avisa nos últimos segundos, e só depois de um vão instrumental relevante
 *  (intro longa, solo, ponte, break, pausa longa). Não pisca: dentro da janela
 *  ele conta de forma contínua até a entrada.
 */
export function decideEntryWarning(
  timeline: TimelineEntry[],
  elapsedSec: number,
  mode: AlertMode,
  opts: { threshold?: number; minGap?: number; prepare?: boolean } = {}
): EntryWarning {
  if (mode === "limpo" || timeline.length === 0) return NO_WARNING;
  const threshold = opts.threshold ?? ALERT_DEFAULTS.entryWarningThresholdSeconds;
  const minGap = opts.minGap ?? ALERT_DEFAULTS.minimumInstrumentalGapSeconds;
  const prepare = opts.prepare ?? ALERT_DEFAULTS.showPrepareMessageBeforeCountdown;

  // Próxima ENTRADA VOCAL (verso, não marcação) depois do tempo atual.
  let nextVocalT: number | null = null;
  for (const e of timeline) {
    if (!e.cue && e.t > elapsedSec) {
      nextVocalT = e.t;
      break;
    }
  }
  if (nextVocalT == null) return NO_WARNING; // sem mais vocais (final instrumental)

  // Início do vão = tempo do último verso já passado (ou 0 = introdução).
  let prevVocalT = 0;
  for (const e of timeline) {
    if (!e.cue && e.t <= elapsedSec) prevVocalT = e.t;
  }
  const gap = nextVocalT - prevVocalT; // tamanho do trecho instrumental atual
  const remaining = Math.ceil(nextVocalT - elapsedSec);
  if (remaining <= 0) return NO_WARNING; // vocal já entrou → esconde

  const countdownText = remaining <= 1 ? "Entrada agora" : `Vocal em ${remaining}s`;

  if (mode === "ensaio") {
    // Mais informativo: mostra durante vãos instrumentais perceptíveis.
    if (gap < ALERT_DEFAULTS.ensaioGapSeconds) return NO_WARNING;
    return { shouldShowWarning: true, warningText: countdownText, warningType: "vocal_entry" };
  }

  // mode === "show" (discreto, padrão): só vãos relevantes, só no finalzinho.
  if (gap < minGap) return NO_WARNING; // pausa curta / refrão colado → nada
  if (remaining > threshold) return NO_WARNING; // ainda longe → silêncio
  if (prepare && remaining > 5) {
    return { shouldShowWarning: true, warningText: "Prepare a entrada", warningType: "vocal_entry" };
  }
  return { shouldShowWarning: true, warningText: countdownText, warningType: "vocal_entry" };
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
