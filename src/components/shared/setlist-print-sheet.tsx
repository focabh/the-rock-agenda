"use client";

import { useState } from "react";
import { Printer, Rows3, Columns2, Minimize2 } from "lucide-react";
import { formatDuracao } from "@/lib/formatters";
import { PrintBackButton } from "@/components/shared/print-back-button";

export type PrintItem = {
  n: number;
  titulo: string;
  tom: string | null;
  preset?: number | null;
  dropada: boolean;
  emenda: boolean;
};

/**
 * Folha de setlist pra impressão/PDF (show e ensaio). Layout limpo, B&W-safe,
 * com tom, DROP, preset de voz e conector de EMENDA. Barra de opções (não sai na
 * impressão): 1 ou 2 colunas + modo compacto (economiza folha).
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
  const [cols, setCols] = useState<1 | 2>(1);
  const [compact, setCompact] = useState(false);

  // Tamanhos por modo (compacto encolhe tudo pra caber mais por página).
  const numCls = compact ? "w-6 text-base" : "w-9 text-2xl";
  const tituloCls = compact ? "text-base" : "text-2xl";
  const rowPad = compact ? "py-1" : "py-2.5";
  const boxCls = compact
    ? "h-8 min-w-8 px-2 text-lg"
    : "h-14 min-w-14 px-3 text-3xl";
  const tomCls = compact ? "text-xl" : "text-4xl";
  const dropCls = compact ? "h-9 px-2.5 text-base" : "h-14 px-3 text-2xl";
  const emendaTxt = compact ? "text-xs" : "text-base";
  const gap = compact ? "gap-2" : "gap-3";

  const opt = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition-colors ${
      active
        ? "bg-black text-white ring-black"
        : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <PrintBackButton />

      {/* Barra de opções — some na impressão */}
      <div className="mx-auto mb-5 flex max-w-2xl flex-wrap items-center gap-2 print:hidden">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Layout
        </span>
        <button type="button" className={opt(cols === 1)} onClick={() => setCols(1)}>
          <Rows3 className="size-4" /> 1 coluna
        </button>
        <button type="button" className={opt(cols === 2)} onClick={() => setCols(2)}>
          <Columns2 className="size-4" /> 2 colunas
        </button>
        <button type="button" className={opt(compact)} onClick={() => setCompact((v) => !v)}>
          <Minimize2 className="size-4" /> Compacto
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-black px-4 py-1.5 text-sm font-bold text-white hover:bg-gray-800"
        >
          <Printer className="size-4" /> Imprimir / PDF
        </button>
      </div>

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

        {/* Lista — título + preset + TOM grande + DROP + emenda. */}
        {items.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Setlist vazia.</p>
        ) : (
          <ol className={`space-y-0 ${cols === 2 ? "sheet-cols2" : ""}`}>
            {items.map((it, idx) => {
              const next = items[idx + 1];
              return (
                <li key={idx} className="break-inside-avoid">
                  <div className={`flex items-center border-b-2 border-gray-200 ${gap} ${rowPad}`}>
                    <span className={`shrink-0 text-right font-mono font-black text-gray-400 ${numCls}`}>
                      {it.n}
                    </span>
                    <p className={`min-w-0 flex-1 font-bold leading-tight ${tituloCls}`}>
                      {it.titulo}
                    </p>
                    {it.preset != null && it.preset > 0 && (
                      <span className={`flex shrink-0 items-center justify-center rounded-xl border-[3px] border-black font-black tabular-nums ${boxCls}`}>
                        P{it.preset}
                      </span>
                    )}
                    {it.dropada && (
                      <span className={`flex shrink-0 items-center rounded-xl bg-black font-black uppercase leading-none tracking-tight text-white ${dropCls}`}>
                        Drop
                      </span>
                    )}
                    {it.tom && (
                      <span className={`flex shrink-0 items-center justify-center rounded-xl border-[3px] border-black font-black tabular-nums ${boxCls} ${tomCls}`}>
                        {it.tom}
                      </span>
                    )}
                  </div>
                  {/* Emenda: segue direto na próxima música — barra que salta aos olhos */}
                  {it.emenda && next && (
                    <div className={`my-1 flex items-center gap-2 rounded-md bg-black px-3 py-1 text-white ${emendaTxt}`}>
                      <span className="font-black leading-none">⟿</span>
                      <span className="font-black uppercase tracking-wider">Emenda</span>
                      <span className="font-bold">— direto na #{next.n} {next.titulo}</span>
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
        /* 2 colunas só onde cabe: telas largas e impressão. No mobile fica 1
           coluna (senão as linhas se sobrepõem). */
        @media screen and (min-width: 640px) {
          .sheet-cols2 { column-count: 2; column-gap: 1.75rem; }
        }
        @media print {
          @page { margin: 1.4cm; }
          .print\\:p-0 { padding: 0 !important; }
          .sheet-cols2 { column-count: 2; column-gap: 1.75rem; }
        }
      `}</style>
    </div>
  );
}
