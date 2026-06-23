import { formatDuracao } from "@/lib/formatters";
import { VozPedalBadge } from "@/components/shared/voz-pedal-badge";
import { PrintTrigger } from "@/app/(app)/shows/[id]/imprimir-setlist/print-trigger";

export type PrintItem = {
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  dropada: boolean;
  vozPedal: string | null;
  emenda: boolean;
};

/**
 * Folha de setlist pra impressão/PDF (show e ensaio). Layout limpo, B&W-safe,
 * com tom, DROP, pedal de voz e conector de EMENDA entre músicas. Dispara o
 * print automaticamente (PrintTrigger).
 */
export function SetlistPrintSheet({
  tipo,
  local,
  dataLabel,
  setlistNome,
  items,
  totalSeg,
  observacoes,
}: {
  tipo: "Show" | "Ensaio";
  local: string;
  dataLabel: string;
  setlistNome?: string | null;
  items: PrintItem[];
  totalSeg: number;
  observacoes?: string | null;
}) {
  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <PrintTrigger />
      <div className="mx-auto max-w-2xl">
        {/* Cabeçalho */}
        <header className="mb-6 border-b-4 border-black pb-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">
                {tipo} · Setlist
              </p>
              <h1 className="text-4xl font-black uppercase leading-none tracking-tight">
                The Rock
              </h1>
            </div>
            <div className="text-right text-sm leading-tight">
              <p className="font-bold">
                {items.length} {items.length === 1 ? "música" : "músicas"}
              </p>
              {totalSeg > 0 && <p className="text-gray-600">~ {formatDuracao(totalSeg)}</p>}
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-700">
            {local}
            {dataLabel ? ` — ${dataLabel}` : ""}
            {setlistNome ? ` · ${setlistNome}` : ""}
          </p>
        </header>

        {/* Lista */}
        {items.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Setlist vazia.</p>
        ) : (
          <ol className="space-y-0">
            {items.map((it, idx) => {
              const next = items[idx + 1];
              return (
                <li key={idx} className="break-inside-avoid">
                  <div className="flex items-baseline gap-3 border-b border-gray-200 py-2">
                    <span className="w-7 shrink-0 text-right font-mono text-lg font-bold text-gray-400">
                      {it.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold leading-tight">{it.titulo}</p>
                      <p className="text-xs text-gray-500">{it.artista}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <VozPedalBadge raw={it.vozPedal} tone="light" />
                      {it.dropada && (
                        <span className="rounded border border-gray-700 bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold">
                          DROP
                        </span>
                      )}
                      {it.tom && (
                        <span className="min-w-[2.2rem] rounded border border-gray-500 px-1.5 py-0.5 text-center font-mono text-sm font-bold tabular-nums">
                          {it.tom}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Conector de emenda (medley) — segue direto na próxima */}
                  {it.emenda && next && (
                    <div className="flex items-center gap-2 py-0.5 pl-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <span className="text-base leading-none">⌐</span>
                      emenda direto na próxima
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {observacoes && (
          <div className="mt-6 border-t border-gray-300 pt-3">
            <p className="whitespace-pre-wrap text-sm text-gray-700">{observacoes}</p>
          </div>
        )}

        <p className="mt-8 text-[10px] uppercase tracking-widest text-gray-400">
          The Rock · gerado pelo StageBoss
        </p>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.4cm; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
