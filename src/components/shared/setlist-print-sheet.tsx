"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, Rows3, Columns2, Minimize2, FileText } from "lucide-react";
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

// Área útil de uma página A4 retrato com margem de 10mm, em px @96dpi.
const PAGE_W = 720; // ~190mm
const PAGE_H = 1030; // ~272mm (com folga)

/**
 * Folha de setlist pra impressão/PDF (show e ensaio). Layout limpo, B&W-safe,
 * com tom, DROP, preset de voz e conector de EMENDA.
 *
 * Modo "1 folha (auto)" (padrão): 2 colunas montadas na mão (grid flex — mais
 * previsível que CSS multi-coluna, que o iOS quebra na impressão) + `zoom` (que
 * encolhe o LAYOUT de verdade, ao contrário de transform) até TUDO caber numa
 * única página A4.
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
  const [onePage, setOnePage] = useState(true);
  const [manualCols, setManualCols] = useState<1 | 2>(1);

  const measureRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!onePage) {
      setZoom(1);
      return;
    }
    const measure = () => {
      const el = measureRef.current;
      if (!el) return;
      const h = el.scrollHeight; // altura natural (o medidor nunca tem zoom)
      setZoom(h > PAGE_H ? Math.max(0.3, (PAGE_H / h) * 0.97) : 1);
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const t = window.setTimeout(measure, 350); // depois das fontes assentarem
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [onePage, items]);

  // No 1-folha usa base compacta (menos quebra de linha) e o zoom afina.
  const compact = onePage ? true : manualCols === 2;
  const numCls = compact ? "w-6 text-sm" : "w-9 text-2xl";
  const tituloCls = compact ? "text-sm leading-tight" : "text-2xl";
  const rowPad = compact ? "py-1" : "py-2.5";
  const boxCls = compact ? "h-7 min-w-7 px-1.5 text-base" : "h-14 min-w-14 px-3 text-3xl";
  const tomCls = compact ? "text-lg" : "text-4xl";
  const dropCls = compact ? "h-7 px-2 text-xs" : "h-14 px-3 text-2xl";
  const emendaTxt = compact ? "text-[11px]" : "text-base";
  const gap = compact ? "gap-2" : "gap-3";

  // 2 colunas quando 1-folha com muitas músicas.
  const twoCols = onePage && items.length > 10;

  const renderRow = (it: PrintItem, idx: number) => {
    const next = items[idx + 1];
    return (
      <li key={it.n} className="break-inside-avoid">
        <div className={`flex items-center border-b-2 border-gray-200 ${gap} ${rowPad}`}>
          <span className={`shrink-0 text-right font-mono font-black text-gray-400 ${numCls}`}>
            {it.n}
          </span>
          <p className={`min-w-0 flex-1 font-bold ${tituloCls}`}>{it.titulo}</p>
          {it.preset != null && it.preset > 0 && (
            <span className={`flex shrink-0 items-center justify-center rounded-lg border-[3px] border-black font-black tabular-nums ${boxCls}`}>
              P{it.preset}
            </span>
          )}
          {it.dropada && (
            <span className={`flex shrink-0 items-center rounded-lg bg-black font-black uppercase leading-none tracking-tight text-white ${dropCls}`}>
              Drop
            </span>
          )}
          {it.tom && (
            <span className={`flex shrink-0 items-center justify-center rounded-lg border-[3px] border-black font-black tabular-nums ${boxCls} ${tomCls}`}>
              {it.tom}
            </span>
          )}
        </div>
        {it.emenda && next && (
          <div className={`my-0.5 flex items-center gap-1.5 rounded bg-black px-2 py-0.5 text-white ${emendaTxt}`}>
            <span className="font-black leading-none">⟿</span>
            <span className="font-black uppercase tracking-wider">Emenda</span>
            <span className="font-bold">→ #{next.n} {next.titulo}</span>
          </div>
        )}
      </li>
    );
  };

  const list = (() => {
    if (items.length === 0) {
      return <p className="py-12 text-center text-gray-500">Setlist vazia.</p>;
    }
    if (twoCols) {
      const half = Math.ceil(items.length / 2);
      const left = items.slice(0, half);
      const right = items.slice(half);
      return (
        <div className="flex items-start gap-5">
          <ol className="min-w-0 flex-1 space-y-0">{left.map((it, i) => renderRow(it, i))}</ol>
          <ol className="min-w-0 flex-1 space-y-0">{right.map((it, i) => renderRow(it, half + i))}</ol>
        </div>
      );
    }
    if (!onePage && manualCols === 2) {
      return <ol className="sheet-cols2 space-y-0">{items.map((it, i) => renderRow(it, i))}</ol>;
    }
    return <ol className="space-y-0">{items.map((it, i) => renderRow(it, i))}</ol>;
  })();

  const opt = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition-colors ${
      active ? "bg-black text-white ring-black" : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-100"
    }`;

  const body = (
    <>
      <header className="mb-4 border-b-4 border-black pb-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">
              {tipo} · Setlist
            </p>
            <h1 className="text-3xl font-black uppercase leading-none tracking-tight">
              The Rock
            </h1>
          </div>
          <div className="text-right text-xs leading-tight">
            <p className="font-bold">
              {items.length} {items.length === 1 ? "música" : "músicas"}
            </p>
            {totalSeg > 0 && <p className="text-gray-600">~ {formatDuracao(totalSeg)}</p>}
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-700">
          {local}
          {dataLabel ? ` — ${dataLabel}` : ""}
          {setlistNome ? ` · ${setlistNome}` : ""}
        </p>
      </header>

      {list}

      {observacoes && (
        <div className="mt-4 border-t border-gray-300 pt-2">
          <p className="whitespace-pre-wrap text-xs text-gray-700">{observacoes}</p>
        </div>
      )}

      <p className="mt-4 text-[10px] uppercase tracking-widest text-gray-400">
        The Rock · gerado pelo StageBoss
      </p>
    </>
  );

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <PrintBackButton />

      {/* Barra de opções — some na impressão */}
      <div className="mx-auto mb-5 flex max-w-2xl flex-wrap items-center gap-2 print:hidden">
        <button type="button" className={opt(onePage)} onClick={() => setOnePage(true)}>
          <FileText className="size-4" /> 1 folha (auto)
        </button>
        <button type="button" className={opt(!onePage)} onClick={() => setOnePage(false)}>
          Manual
        </button>

        {!onePage && (
          <>
            <span className="ml-1 text-xs font-bold uppercase tracking-wider text-gray-400">Colunas</span>
            <button type="button" className={opt(manualCols === 1)} onClick={() => setManualCols(1)}>
              <Rows3 className="size-4" /> 1
            </button>
            <button type="button" className={opt(manualCols === 2)} onClick={() => setManualCols(2)}>
              <Columns2 className="size-4" /> 2
            </button>
          </>
        )}

        {onePage && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Minimize2 className="size-3.5" /> Cabe tudo numa folha{zoom < 1 ? ` · ${Math.round(zoom * 100)}%` : ""}
          </span>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-black px-4 py-1.5 text-sm font-bold text-white hover:bg-gray-800"
        >
          <Printer className="size-4" /> Imprimir / PDF
        </button>
      </div>

      {/* Medidor oculto: mesmo conteúdo em tamanho natural (sem zoom), só pra
          calcular a escala. Não aparece na tela nem na impressão. */}
      {onePage && (
        <div aria-hidden className="pointer-events-none fixed top-0 print:hidden" style={{ width: PAGE_W, left: -99999 }}>
          <div ref={measureRef} style={{ width: PAGE_W }}>
            {body}
          </div>
        </div>
      )}

      {onePage ? (
        <div className="mx-auto max-w-full overflow-x-auto">
          <div className="onepage-frame" style={{ width: PAGE_W, zoom: String(zoom) }}>
            {body}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">{body}</div>
      )}

      <style>{`
        @media screen and (min-width: 640px) {
          .sheet-cols2 { column-count: 2; column-gap: 1.75rem; }
        }
        @media print {
          @page { size: A4 portrait; margin: ${onePage ? "10mm" : "1.4cm"}; }
          .print\\:p-0 { padding: 0 !important; }
          .sheet-cols2 { column-count: 2; column-gap: 1.75rem; }
          .onepage-frame { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
