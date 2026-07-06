// Transpose Assistant — cor do TOM por distância do padrão da banda.
// A ideia: o músico identifica o tom de relance pela cor.
//   igual ao padrão  → âmbar (é o "normal" da banda)
//   original (0)      → cinza (sem transposição)
//   mais dropado que o padrão → laranja (1 abaixo) → vermelho (2+ abaixo)
//   mais alto que o padrão    → azul (exceção pra cima)
//   tom desconhecido / vazio  → neutro

/** "Original"/""/"0" → 0; "-2"/"+1" → número; lixo → null. */
export function parseTomNum(tom: string | null | undefined): number | null {
  if (tom == null) return null;
  const t = tom.trim();
  if (!t) return null;
  if (/^original$/i.test(t)) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type TomTone = "padrao" | "original" | "orange" | "red" | "up" | "plain";

/** Classifica o tom em um "tom de alerta" relativo ao padrão da banda. */
export function tomTone(tom: string | null | undefined, defaultTom: string | null | undefined): TomTone {
  const n = parseTomNum(tom);
  if (n == null) return "plain";
  if (n === 0) return "original";
  const d = parseTomNum(defaultTom);
  if (d == null) return "padrao"; // sem padrão configurado → comportamento antigo (âmbar)
  const drop = d - n; // quantos semitons a MAIS dropado que o padrão
  if (drop === 0) return "padrao";
  if (drop < 0) return "up"; // mais alto que o padrão
  if (drop === 1) return "orange";
  return "red";
}

/** Classes Tailwind por tom, em duas variantes de fundo. */
export function tomBadgeClass(
  tom: string | null | undefined,
  defaultTom: string | null | undefined,
  variant: "dark" | "app" = "app"
): string {
  const tone = tomTone(tom, defaultTom);
  if (variant === "dark") {
    // Teleprompter (fundo preto).
    switch (tone) {
      case "original":
        return "text-white/70 ring-white/25";
      case "orange":
        return "text-orange-300 ring-orange-400/50";
      case "red":
        return "text-red-400 ring-red-500/50";
      case "up":
        return "text-sky-300 ring-sky-400/50";
      default: // padrao / plain
        return "text-amber-300 ring-amber-400/50";
    }
  }
  // UI clara/escura do app (setlist, modo show).
  switch (tone) {
    case "original":
      return "text-muted-foreground ring-border";
    case "orange":
      return "text-orange-600 ring-orange-500/40 dark:text-orange-300";
    case "red":
      return "text-red-600 ring-red-500/40 dark:text-red-400";
    case "up":
      return "text-sky-600 ring-sky-500/40 dark:text-sky-300";
    default:
      return "text-amber-600 ring-amber-500/40 dark:text-amber-300";
  }
}
