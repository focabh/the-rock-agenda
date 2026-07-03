import { SlidersHorizontal } from "lucide-react";

/**
 * Stage Master — badge do PRESET do pedal de voz. Bem visível e consistente em
 * todo canto (repertório, setlist, teleprompter, letras, impressão, imagem).
 * `preset` null/≤0 → não renderiza nada.
 */
export function PresetBadge({
  preset,
  variant = "app",
  showLabel = false,
  className = "",
}: {
  preset: number | null | undefined;
  /** app = UI clara/escura · solid = fundo escuro (teleprompter/imagem) · print = P&B */
  variant?: "app" | "solid" | "print";
  /** mostra "PRESET" por extenso (cards grandes) em vez de só "P". */
  showLabel?: boolean;
  className?: string;
}) {
  if (preset == null || preset <= 0) return null;
  const base =
    "inline-flex shrink-0 items-center gap-1 font-black uppercase leading-none tracking-wide";
  const byVariant =
    variant === "solid"
      ? "rounded bg-violet-500 px-2 py-0.5 text-white"
      : variant === "print"
        ? "rounded-md border-[3px] border-black px-2 py-0.5 text-black"
        : "rounded bg-violet-500/15 px-2 py-0.5 text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300";
  return (
    <span className={`${base} ${byVariant} ${className}`} title={`Preset do pedal de voz: ${preset}`}>
      {variant !== "print" && <SlidersHorizontal className="size-3" />}
      {showLabel ? "Preset " : "P"}
      {preset}
    </span>
  );
}
