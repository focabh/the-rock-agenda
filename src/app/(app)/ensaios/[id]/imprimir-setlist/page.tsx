import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { formatDataBR } from "@/lib/formatters";
import {
  SetlistPrintSheet,
  type PrintItem,
} from "@/components/shared/setlist-print-sheet";

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
  const ordered = (setlist?.items ?? []).sort((a, b) => a.ordem - b.ordem);
  const totalSeg = ordered.reduce(
    (s, i) => s + (i.duracaoSeg ?? i.song.duracaoSeg ?? 0),
    0
  );
  const items: PrintItem[] = ordered.map((it, idx) => ({
    n: idx + 1,
    titulo: it.song.titulo,
    artista: it.song.artista,
    tom: it.tom ?? it.song.tom,
    dropada: it.song.dropada,
    vozPedal: it.song.vozPedal,
    emenda: it.emenda,
  }));

  return (
    <SetlistPrintSheet
      tipo="Ensaio"
      local={r.local || "Ensaio"}
      dataLabel={formatDataBR(r.data, true)}
      setlistNome={setlist?.nome}
      items={items}
      totalSeg={totalSeg}
      observacoes={setlist?.observacoesGerais}
    />
  );
}
