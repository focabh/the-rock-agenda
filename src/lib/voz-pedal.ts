/**
 * Config do pedal de voz por música (ex.: Flamma FV-02). Guardada como JSON em
 * `songs.vozPedal`. Mostrada no setlist, teleprompter, modo-show e caderno.
 */

export type VozPedal = {
  mode: string; // "OFF" | "1".."9"
  reverb: string; // código do pedal: "RM" | "HL" | "PL" ...
  level: number; // 0–100 (%)
};

/** Rótulos prováveis dos reverbs do Flamma FV-02 (só pra tooltip). */
export const REVERB_LABELS: Record<string, string> = {
  RM: "Room",
  HL: "Hall",
  PL: "Plate",
  CH: "Church",
  SP: "Spring",
};

/** Lê o JSON salvo com tolerância a lixo. Retorna null se inválido/vazio. */
export function parseVozPedal(raw: string | null | undefined): VozPedal | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<VozPedal>;
    if (o == null || typeof o !== "object") return null;
    const mode = String(o.mode ?? "").trim();
    const reverb = String(o.reverb ?? "").trim().toUpperCase();
    const level = Number(o.level ?? 0);
    if (!mode) return null;
    return {
      mode: mode.toUpperCase(),
      reverb,
      level: Number.isFinite(level) ? Math.max(0, Math.min(100, Math.round(level))) : 0,
    };
  } catch {
    return null;
  }
}

/** Texto curto pra exibir: "Mode 1 · RM · 15%" ou "Pedal OFF". */
export function formatVozPedal(p: VozPedal | null): string {
  if (!p) return "";
  if (p.mode.toUpperCase() === "OFF") return "Pedal OFF";
  const parts = [`Mode ${p.mode}`];
  if (p.reverb) parts.push(p.reverb);
  parts.push(`${p.level}%`);
  return parts.join(" · ");
}

/** Normaliza título pra casar a tabela colada com o repertório (tira acento,
 *  pontuação e o trecho entre parênteses tipo "(Seether)"). */
export function normalizeTitle(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacríticos
    .replace(/\([^)]*\)/g, " ") // "(Seether)" etc.
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type VozPedalRow = { titulo: string; pedal: VozPedal };

/**
 * Faz o parse de uma tabela colada (markdown `| Música | Mode | Reverb | Level |`
 * ou colunas separadas por tab/;). Ignora cabeçalho e linha separadora.
 */
export function parseVozPedalTable(text: string): VozPedalRow[] {
  const rows: VozPedalRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    // células: markdown (|) ou tab/;  — remove bordas | das pontas
    const cells = raw
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/\||\t|;/)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    const [titulo, modeRaw, reverbRaw, levelRaw] = cells;
    // pula cabeçalho e separador
    if (/^m[uú]sica$/i.test(titulo) || /^-+$/.test(titulo) || !titulo) continue;
    const mode = modeRaw.toUpperCase();
    const level = Number(String(levelRaw).replace(/[^\d]/g, "")) || 0;
    rows.push({
      titulo,
      pedal: { mode, reverb: reverbRaw.toUpperCase(), level },
    });
  }
  return rows;
}
