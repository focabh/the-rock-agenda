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

/** Duração compacta mm:ss pra cada linha (formatDuracao é verboso pro total). */
function mmss(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
    <div className="min-h-screen bg-white text-black p-8 print:p-12">
      <PrintTrigger />
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-end justify-between border-b-2 border-black pb-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              The Rock
            </h1>
            <p className="text-sm">Repertório da banda</p>
          </div>
          <div className="text-right text-sm">
            <p>
              {visiveis.length}{" "}
              {visiveis.length === 1 ? "música" : "músicas"}
            </p>
            {totalSeg > 0 && <p>~ {formatDuracao(totalSeg)}</p>}
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
            <ol className="space-y-0.5">
              {grupo.musicas.map((song, idx) => (
                <li
                  key={song.id}
                  className="flex items-baseline gap-2 py-0.5 text-base"
                >
                  <span className="w-6 text-right font-mono text-sm text-gray-500">
                    {idx + 1}
                  </span>
                  <span className="font-bold">
                    {song.favorita && (
                      <span className="text-gray-500 mr-1">★</span>
                    )}
                    {song.titulo}
                  </span>
                  <span className="text-sm text-gray-600 flex-1">
                    {song.artista}
                  </span>
                  {song.dropada && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 border border-gray-600 rounded bg-gray-200">
                      DROP
                    </span>
                  )}
                  {song.tom && (
                    <span className="font-mono text-xs tabular-nums px-1.5 py-0.5 border border-gray-400 rounded">
                      {song.tom}
                    </span>
                  )}
                  {song.bpm != null && (
                    <span className="font-mono text-xs tabular-nums text-gray-500 w-10 text-right">
                      {song.bpm}
                    </span>
                  )}
                  {song.duracaoSeg != null && (
                    <span className="font-mono text-xs tabular-nums text-gray-500 w-10 text-right">
                      {mmss(song.duracaoSeg)}
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
          ★ favorita · DROP = afinação dropada · números à direita = BPM e
          duração
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
