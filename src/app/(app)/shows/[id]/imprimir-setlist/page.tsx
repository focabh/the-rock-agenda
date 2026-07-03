import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { formatDataBR } from "@/lib/formatters";
import {
  SetlistPrintSheet,
  type PrintItem,
} from "@/components/shared/setlist-print-sheet";

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
      setlists: { with: { items: { with: { song: true } } } },
    },
  });
  if (!show) notFound();

  const setlist =
    (sl && show.setlists.find((s) => s.id === sl)) || show.setlists[0];
  const ordered = (setlist?.items ?? []).sort((a, b) => a.ordem - b.ordem);
  const totalSeg = ordered.reduce((s, i) => s + (i.song.duracaoSeg ?? 210), 0);
  const items: PrintItem[] = ordered.map((it, idx) => ({
    n: idx + 1,
    titulo: it.song.titulo,
    tom: it.song.tom,
    preset: it.song.vozPreset,
    dropada: it.song.dropada,
    emenda: it.emenda,
  }));

  return (
    <SetlistPrintSheet
      tipo="Show"
      local={show.casa.nome}
      dataLabel={formatDataBR(show.data, true)}
      setlistNome={setlist?.nome}
      items={items}
      totalSeg={totalSeg}
      observacoes={setlist?.observacoesGerais}
    />
  );
}
