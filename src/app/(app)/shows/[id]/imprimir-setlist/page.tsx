import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { shows, setlists, setlistItems, songs } from "@/db/schema";
import { formatDataBR, formatDuracao } from "@/lib/formatters";
import { PrintTrigger } from "./print-trigger";

export default async function ImprimirSetlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sl?: string }>;
}) {
  const { id } = await params;
  const { sl } = await searchParams;
  const show = await db.query.shows.findFirst({
    where: eq(shows.id, id),
    with: {
      casa: true,
      setlists: {
        with: {
          items: { with: { song: true } },
        },
      },
    },
  });
  if (!show) notFound();

  const setlist =
    (sl && show.setlists.find((s) => s.id === sl)) || show.setlists[0];
  const items = (setlist?.items ?? []).sort((a, b) => a.ordem - b.ordem);
  const totalSeg = items.reduce((s, i) => s + (i.duracaoSeg ?? 0), 0);

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-12">
      <PrintTrigger />
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-end justify-between border-b-2 border-black pb-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              The Rock
            </h1>
            <p className="text-sm">
              {show.casa.nome} — {formatDataBR(show.data, true)}
              {setlist?.nome && ` · ${setlist.nome}`}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>
              {items.length} {items.length === 1 ? "música" : "músicas"}
            </p>
            {totalSeg > 0 && <p>~ {formatDuracao(totalSeg)}</p>}
          </div>
        </header>

        <ol className="space-y-1 text-lg">
          {items.map((item, idx) => (
            <li key={item.id} className="flex items-baseline gap-3 py-1">
              <span className="w-8 text-right font-mono text-base text-gray-500">
                {idx + 1}
              </span>
              <span className="font-bold flex-1">{item.song.titulo}</span>
              <span className="text-sm text-gray-600">
                {item.song.artista}
              </span>
              {item.tom && (
                <span className="font-mono text-sm tabular-nums px-2 py-0.5 border border-gray-400 rounded">
                  {item.tom}
                </span>
              )}
            </li>
          ))}
        </ol>

        {items.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            Setlist vazia.
          </p>
        )}

        {setlist?.observacoesGerais && (
          <div className="mt-8 pt-4 border-t border-gray-300">
            <p className="text-sm whitespace-pre-wrap">
              {setlist.observacoesGerais}
            </p>
          </div>
        )}
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
