import { formatDuracao } from "@/lib/formatters";
import { PrintTrigger } from "@/app/(app)/shows/[id]/imprimir-setlist/print-trigger";
import { PrintBackButton } from "@/components/shared/print-back-button";

export type PrintItem = {
  n: number;
  titulo: string;
  tom: string | null;
  dropada: boolean;
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
      <PrintBackButton />
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

        {/* Lista — título + TOM grande + DROP + emenda. Nada mais. */}
        {items.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Setlist vazia.</p>
        ) : (
          <ol className="space-y-0">
            {items.map((it, idx) => {
              const next = items[idx + 1];
              return (
                <li key={idx} className="break-inside-avoid">
                  <div className="flex items-center gap-3 border-b-2 border-gray-200 py-2.5">
                    <span className="w-9 shrink-0 text-right font-mono text-2xl font-black text-gray-400">
                      {it.n}
                    </span>
                    <p className="min-w-0 flex-1 text-2xl font-bold leading-tight">
                      {it.titulo}
                    </p>
                    {it.dropada && (
                      <span className="flex h-14 shrink-0 items-center rounded-xl bg-black px-3 text-2xl font-black uppercase leading-none tracking-tight text-white">
                        Drop
                      </span>
                    )}
                    {it.tom && (
                      <span className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-xl border-[3px] border-black px-3 text-4xl font-black tabular-nums">
                        {it.tom}
                      </span>
                    )}
                  </div>
                  {/* Emenda: segue direto na próxima música — salta aos olhos */}
                  {it.emenda && next && (
                    <div className="flex items-center gap-2 border-l-4 border-black py-1.5 pl-3">
                      <span className="inline-flex items-center rounded bg-black px-2 py-0.5 text-base font-black uppercase tracking-wider text-white">
                        ⟿ Emenda
                      </span>
                      <span className="text-base font-bold">
                        direto na #{next.n} — {next.titulo}
                      </span>
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
