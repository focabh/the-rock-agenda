import { formatBRL } from "@/lib/formatters";

export type DonutSeg = { label: string; value: number; color: string };

/** Donut em SVG puro (sem dependência). Mostra a composição de um total. */
export function DonutChart({
  segments,
  size = 168,
  thickness = 24,
  centerTop = "Total",
}: {
  segments: DonutSeg[];
  size?: number;
  thickness?: number;
  centerTop?: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#27272a"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = Math.max(0, s.value) / total;
            const len = frac * c;
            const seg = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
              />
            );
            acc += len;
            return seg;
          })}
      </svg>

      <ul className="w-full space-y-1.5 text-sm">
        <li className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
          {centerTop}:{" "}
          <span className="font-mono text-amber-400">{formatBRL(total)}</span>
        </li>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1 truncate text-zinc-100">{s.label}</span>
              <span className="font-mono text-zinc-300">{formatBRL(s.value)}</span>
              <span className="w-10 text-right text-xs text-zinc-500">
                {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
