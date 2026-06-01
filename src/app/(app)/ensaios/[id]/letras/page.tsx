import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { formatDataBR } from "@/lib/formatters";
import { computeStageCues } from "@/lib/stage-cues";
import { getCurrentUser, isAdmin, getBrand } from "@/lib/auth";
import { LyricsBooklet } from "@/app/(app)/shows/[id]/letras/lyrics-booklet";

export default async function EnsaioLetrasPage({
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
  const songs = items.map((it, i) => ({
    n: i + 1,
    titulo: it.song.titulo,
    artista: it.song.artista,
    tom: it.tom ?? null,
    lyrics: it.song.lyrics?.trim() || null,
    durationSeg: it.song.duracaoSeg,
  }));

  const [user, brand] = await Promise.all([getCurrentUser(), getBrand()]);
  const cues = computeStageCues(
    items.map((it) => ({ energia: it.song.energia, momento: it.song.momento })),
    { bandName: brand.bandName }
  );

  return (
    <LyricsBooklet
      backHref={`/ensaios/${id}`}
      docxHref={`/ensaios/${id}/letras/docx${setlist?.id ? `?sl=${setlist.id}` : ""}`}
      titulo={r.local || "Ensaio"}
      subtitulo={`${formatDataBR(r.data, true)}${setlist?.nome ? ` · ${setlist.nome}` : ""}`}
      songs={songs}
      cues={cues}
      setlistId={setlist?.id}
      canRefine={isAdmin(user)}
    />
  );
}
