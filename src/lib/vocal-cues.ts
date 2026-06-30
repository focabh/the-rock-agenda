// Stage Master — Vocal Cues. Instruções de texto LIVRE pro vocalista (nunca
// interpretadas): presets, harmonia ON/OFF, "respirar", "esperar batera" etc.
// Cada música tem um cue inicial + cues por linha da letra.

export type VocalLineCue = {
  line: number; // índice da linha na letra (songs.lyrics)
  snapshot: string; // texto da linha (pra casar mesmo se a letra mudar de ordem)
  cues: string[]; // um ou mais cues/observações de texto livre
};

export type VocalCues = VocalLineCue[];

/** Equipamentos vocais comuns (sugestões — o campo é texto livre). */
export const VOCAL_EQUIPMENT = [
  "Boss VE-22",
  "TC Helicon VoiceLive Play",
  "Boss VE-20",
  "Flamma FV02",
  "Zoom V3",
  "Headrush VX5",
] as const;

/** Lê o JSON de vocalCues com tolerância a lixo. */
export function parseVocalCues(raw: string | null | undefined): VocalCues {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    if (!Array.isArray(a)) return [];
    return a
      .map((x) => ({
        line: Number(x?.line),
        snapshot: String(x?.snapshot ?? ""),
        cues: Array.isArray(x?.cues)
          ? x.cues.filter((c: unknown) => typeof c === "string" && c.trim()).map((c: string) => c.trim())
          : [],
      }))
      .filter((x) => Number.isFinite(x.line) && x.cues.length > 0);
  } catch {
    return [];
  }
}

/** Normaliza uma linha pra casar snapshot ↔ linha do teleprompter (acentos/pontuação). */
export function normalizeLine(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mapa índice-da-linha → cues. */
export function cuesByLineIndex(vc: VocalCues): Map<number, string[]> {
  const m = new Map<number, string[]>();
  for (const v of vc) m.set(v.line, v.cues);
  return m;
}

/** Mapa texto-normalizado-da-linha → cues (pra casar com a letra sincronizada). */
export function cuesByLineText(vc: VocalCues): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const v of vc) {
    const k = normalizeLine(v.snapshot);
    if (k) m.set(k, v.cues);
  }
  return m;
}
