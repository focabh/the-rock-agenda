import { asc } from "drizzle-orm";
import { db } from "@/db";
import { songs, type Song } from "@/db/schema";
import { formatDuracao } from "@/lib/formatters";
import { PrintTrigger } from "./print-trigger";

// Ordem e rótulos dos status na folha impressa.
const GRUPOS: { status: Song["status"]; label: string }[] = [
  { status: "pronta", label: "Prontas" },
  { status: "precisa_ensaiar", label: "Precisa ensaiar" },
  { status: "aprendendo", label: "Aprendendo" },
  { status: "ideia_futura", label: "Ideias futuras" },
  { status: "aposentada", label: "Aposentadas" },
];

export default async function ImprimirRepertorioPage({
  searchParams,
}: {
  searchParams: Promise<{ aposentadas?: string }>;
}) {
  const { aposentadas } = await searchParams;
  const incluirAposentadas = aposentadas === "1";

  const lista = await db
    .select()
    .from(songs)
    .orderBy(asc(songs.titulo));

  const visiveis = incluirAposentadas
    ? lista
    : lista.filter((s) => s.status !== "aposentada");

  const grupos = GRUPOS.map((g) => ({
    ...g,
    musicas: visiveis.filter((s) => s.status === g.status),
  })).filter((g) => g.musicas.length > 0);

  const totalSeg = visiveis.reduce((acc, s) => acc + (s.duracaoSeg ?? 0), 0);

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <PrintTrigger />
      <div className="max-w-2xl mx-auto">
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
                {visiveis.length}{" "}
                {visiveis.length === 1 ? "música" : "músicas"}
              </p>
              {totalSeg > 0 && (
                <p className="text-gray-600">~ {formatDuracao(totalSeg)}</p>
              )}
            </div>
          </div>
        </header>

        {grupos.map((grupo) => (
          <section key={grupo.status} className="mb-7 break-inside-avoid">
            <h2 className="text-sm font-black uppercase tracking-wide border-b border-gray-400 pb-1 mb-2">
              {grupo.label}{" "}
              <span className="font-mono text-gray-500">
                ({grupo.musicas.length})
              </span>
            </h2>
            <ol className="space-y-0">
              {grupo.musicas.map((song, idx) => (
                <li
                  key={song.id}
                  className="flex items-center gap-3 border-b border-gray-200 py-1.5"
                >
                  <span className="w-7 shrink-0 text-right font-mono text-lg font-black text-gray-400">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-xl font-bold leading-tight">
                    {song.titulo}
                  </span>
                  {song.dropada && (
                    <span className="shrink-0 rounded-md border-2 border-black px-2 py-0.5 text-[11px] font-black uppercase">
                      Drop
                    </span>
                  )}
                  {song.tom && (
                    <span className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border-[3px] border-black px-2 text-3xl font-black tabular-nums">
                      {song.tom}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}

        {visiveis.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            Nenhuma música no repertório.
          </p>
        )}

        <p className="mt-8 pt-3 border-t border-gray-300 text-xs text-gray-400">
          Número = ordem · caixa grande = tom · DROP = afinação dropada
        </p>
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
