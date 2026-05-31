import { formatBRL } from "@/lib/formatters";

export type MonthPoint = { label: string; entradas: number; saidas: number };

/** Barras agrupadas (entradas x saídas) por mês — SVG puro. */
export function MonthlyBars({ months }: { months: MonthPoint[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.entradas, m.saidas)));
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-400" /> Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-red-500" /> Saídas
        </span>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 140 }}>
        {months.map((m) => (
          <div
            key={m.label}
            className="group relative flex flex-1 flex-col items-center justify-end gap-1"
            style={{ height: "100%" }}
            title={`${m.label}: entra ${formatBRL(m.entradas)} · sai ${formatBRL(m.saidas)}`}
          >
            <div className="flex h-full w-full items-end justify-center gap-[2px]">
              <div
                className="w-1/2 rounded-t-sm bg-amber-400/80"
                style={{ height: `${(m.entradas / max) * 100}%` }}
              />
              <div
                className="w-1/2 rounded-t-sm bg-red-500/80"
                style={{ height: `${(m.saidas / max) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
