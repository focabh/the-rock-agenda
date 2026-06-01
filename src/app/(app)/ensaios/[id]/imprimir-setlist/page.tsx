import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { formatDataBR, formatDuracao } from "@/lib/formatters";
import { PrintTrigger } from "@/app/(app)/shows/[id]/imprimir-setlist/print-trigger";

export default async function ImprimirEnsaioSetlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sl?: string }>;
}) {
  const { id } = await params;
  const { sl } = await searchParams;
  const r = await db.query.rehearsals.findFirst({
    where: eq(rehearsals.id, id),
    with: { setlists: { with: { items: { with: { song: true } } } } },
  });
  if (!r) notFound();

  const setlist = (sl && r.setlists.find((s) => s.id === sl)) || r.setlists[0];
  const items = (setlist?.items ?? []).sort((a, b) => a.ordem - b.ordem);
  const totalSeg = items.reduce((s, i) => s + (i.duracaoSeg ?? 0), 0);

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-12">
      <PrintTrigger />
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-end justify-between border-b-2 border-black pb-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">The Rock — Ensaio</h1>
            <p className="text-sm">
              {(r.local || "Ensaio")} — {formatDataBR(r.data, true)}
              {setlist?.nome && ` · ${setlist.nome}`}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>{items.length} {items.length === 1 ? "música" : "músicas"}</p>
            {totalSeg > 0 && <p>~ {formatDuracao(totalSeg)}</p>}
          </div>
        </header>

        <ol className="space-y-1 text-lg">
          {items.map((item, idx) => (
            <li key={item.id} className="flex items-baseline gap-3 py-1">
              <span className="w-8 text-right font-mono text-base text-gray-500">{idx + 1}</span>
              <span className="font-bold flex-1">{item.song.titulo}</span>
              <span className="text-sm text-gray-600">{item.song.artista}</span>
              {item.song.dropada && <span className="text-xs font-bold px-2 py-0.5 border border-gray-600 rounded bg-gray-200">DROP</span>}
              {(item.tom ?? item.song.tom) && <span className="font-mono text-sm tabular-nums px-2 py-0.5 border border-gray-400 rounded">{item.tom ?? item.song.tom}</span>}
            </li>
          ))}
        </ol>

        {items.length === 0 && <p className="text-center text-gray-500 py-12">Setlist vazia.</p>}
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          .print\\:p-12 { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
