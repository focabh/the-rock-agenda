import { asc } from "drizzle-orm";
import { db } from "@/db";
import { songs, type Song } from "@/db/schema";
import { formatDuracao } from "@/lib/formatters";
import { RepertorioPrintList, type RepPrintGroup } from "./print-list";

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

  const lista = await db.select().from(songs).orderBy(asc(songs.titulo));

  const visiveis = incluirAposentadas
    ? lista
    : lista.filter((s) => s.status !== "aposentada");

  const grupos: RepPrintGroup[] = GRUPOS.map((g) => ({
    label: g.label,
    musicas: visiveis
      .filter((s) => s.status === g.status)
      .map((s) => ({
        titulo: s.titulo,
        tom: s.tom,
        vozPreset: s.vozPreset,
        dropada: s.dropada,
      })),
  })).filter((g) => g.musicas.length > 0);

  const totalSeg = visiveis.reduce((acc, s) => acc + (s.duracaoSeg ?? 0), 0);

  return (
    <RepertorioPrintList
      grupos={grupos}
      total={visiveis.length}
      duracaoLabel={totalSeg > 0 ? formatDuracao(totalSeg) : null}
    />
  );
}
