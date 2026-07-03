"use client";

import { useState } from "react";
import { Printer, Rows3, Columns2, Minimize2 } from "lucide-react";
import { PrintBackButton } from "@/components/shared/print-back-button";

export type RepPrintSong = {
  titulo: string;
  tom: string | null;
  vozPreset: number | null;
  dropada: boolean;
};
export type RepPrintGroup = { label: string; musicas: RepPrintSong[] };

/** Folha do repertório (P&B) com opções: 1/2 colunas + compacto (menos folha). */
export function RepertorioPrintList({
  grupos,
  total,
  duracaoLabel,
}: {
  grupos: RepPrintGroup[];
  total: number;
  duracaoLabel: string | null;
}) {
  const [cols, setCols] = useState<1 | 2>(2);
  const [compact, setCompact] = useState(true);

  const tituloCls = compact ? "text-base" : "text-xl";
  const rowPad = compact ? "py-0.5" : "py-1.5";
  const numCls = compact ? "w-6 text-sm" : "w-7 text-lg";
  const boxCls = compact ? "h-8 min-w-8 px-1.5 text-lg" : "h-11 min-w-11 px-2 text-2xl";
  const tomCls = compact ? "text-xl" : "text-3xl";

  const opt = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition-colors ${
      active ? "bg-black text-white ring-black" : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <PrintBackButton />

      <div className="mx-auto mb-5 flex max-w-2xl flex-wrap items-center gap-2 print:hidden">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Layout</span>
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
        <header className="mb-6 border-b-4 border-black pb-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">
                Repertório
              </p>
              <h1 className="text-4xl font-black uppercase leading-none tracking-tight">
                The Rock
              </h1>
            </div>
            <div className="text-right text-sm leading-tight">
              <p className="font-bold">
                {total} {total === 1 ? "música" : "músicas"}
              </p>
              {duracaoLabel && <p className="text-gray-600">~ {duracaoLabel}</p>}
            </div>
          </div>
        </header>

        {grupos.map((grupo) => (
          <section key={grupo.label} className="mb-7 break-inside-avoid">
            <h2 className="mb-2 border-b border-gray-400 pb-1 text-sm font-black uppercase tracking-wide">
              {grupo.label}{" "}
              <span className="font-mono text-gray-500">({grupo.musicas.length})</span>
            </h2>
            <ol className={`space-y-0 ${cols === 2 ? "sheet-cols2" : ""}`}>
              {grupo.musicas.map((song, idx) => (
                <li
                  key={idx}
                  className={`flex items-center gap-3 border-b border-gray-200 ${rowPad} break-inside-avoid`}
                >
                  <span className={`shrink-0 text-right font-mono font-black text-gray-400 ${numCls}`}>
                    {idx + 1}
                  </span>
                  <span className={`min-w-0 flex-1 font-bold leading-tight ${tituloCls}`}>
                    {song.titulo}
                  </span>
                  {song.vozPreset != null && song.vozPreset > 0 && (
                    <span className={`flex shrink-0 items-center justify-center rounded-lg border-[3px] border-black font-black tabular-nums ${boxCls}`}>
                      P{song.vozPreset}
                    </span>
                  )}
                  {song.dropada && (
                    <span className={`flex shrink-0 items-center rounded-lg bg-black font-black uppercase leading-none tracking-tight text-white ${compact ? "h-8 px-2.5 text-base" : "h-11 px-3 text-xl"}`}>
                      Drop
                    </span>
                  )}
                  {song.tom && (
                    <span className={`flex shrink-0 items-center justify-center rounded-lg border-[3px] border-black font-black tabular-nums ${boxCls} ${tomCls}`}>
                      {song.tom}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}

        {total === 0 && (
          <p className="py-12 text-center text-gray-500">Nenhuma música no repertório.</p>
        )}

        <p className="mt-8 border-t border-gray-300 pt-3 text-xs text-gray-400">
          Número = ordem · caixa grande = tom · P = preset do pedal de voz · DROP = afinação dropada
        </p>
      </div>

      <style>{`
        /* 2 colunas só onde cabe: telas largas e impressão. No mobile fica 1
           coluna (senão as linhas se sobrepõem). */
        @media screen and (min-width: 640px) {
          .sheet-cols2 { column-count: 2; column-gap: 1.75rem; }
        }
        @media print {
          @page { margin: 1.5cm; }
          .print\\:p-0 { padding: 0 !important; }
          .sheet-cols2 { column-count: 2; column-gap: 1.75rem; }
        }
      `}</style>
    </div>
  );
}
