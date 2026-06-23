import { SlidersHorizontal } from "lucide-react";
import {
  parseVozPedal,
  formatVozPedal,
  REVERB_LABELS,
  type VozPedal,
} from "@/lib/voz-pedal";

/**
 * Chip com a config do pedal de voz da música (ex.: "🎚 Mode 1 · RM · 15%").
 * Componente puro (server ou client). Aceita o JSON cru (`raw`) ou já parseado.
 * `tone="light"` pra fundos claros (caderno impresso/print).
 */
export function VozPedalBadge({
  raw,
  config,
  tone = "dark",
  className = "",
}: {
  raw?: string | null;
  config?: VozPedal | null;
  tone?: "dark" | "light";
  className?: string;
}) {
  const p = config ?? parseVozPedal(raw ?? null);
  if (!p) return null;
  const off =
    (p.mode ?? "").toUpperCase() === "OFF" ||
    (p.nome ?? "").toLowerCase() === "seco";
  const title = p.nome
    ? `Pedal de voz — preset "${p.nome}"${p.slot ? ` (${p.slot})` : ""}`
    : (p.mode ?? "").toUpperCase() === "OFF"
      ? "Pedal de voz desligado"
      : `Pedal de voz — Mode ${p.mode} · ${REVERB_LABELS[p.reverb ?? ""] ?? p.reverb} · ${p.level}%`;
  const palette =
    tone === "light"
      ? "border border-gray-300 bg-gray-100 text-gray-700"
      : "ring-1 ring-inset ring-sky-500/30 bg-sky-500/10 text-sky-300";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] leading-none ${palette} ${
        off ? "opacity-70" : ""
      } ${className}`}
      title={title}
    >
      <SlidersHorizontal className="size-3" />
      {formatVozPedal(p)}
    </span>
  );
}
