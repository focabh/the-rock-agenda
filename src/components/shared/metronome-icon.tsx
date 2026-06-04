/** Ícone de metrônomo (SVG próprio, estilo lucide) — corpo triangular + pêndulo.
 *  lucide-react não tem um metrônomo, então usamos este em todo o app. */
export function MetronomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* corpo (trapézio: estreito em cima, largo embaixo) */}
      <path d="M9 3h6l3 17H6z" />
      {/* base / pés */}
      <path d="M5 20h14" />
      {/* pêndulo / agulha */}
      <path d="M12 15.5 16 7" />
    </svg>
  );
}
