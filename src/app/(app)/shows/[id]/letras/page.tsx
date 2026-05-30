import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { formatDataBR } from "@/lib/formatters";
import { LyricsBooklet } from "./lyrics-booklet";

export default async function LetrasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const show = await db.query.shows.findFirst({
    where: eq(shows.id, id),
    with: {
      casa: true,
      setlists: { with: { items: { with: { song: true } } } },
    },
  });
  if (!show) notFound();

  const setlist = show.setlists[0];
  const items = (setlist?.items ?? []).sort((a, b) => a.ordem - b.ordem);
  const songs = items.map((it, i) => ({
    n: i + 1,
    titulo: it.song.titulo,
    artista: it.song.artista,
    tom: it.tom ?? null,
    lyrics: it.song.lyrics?.trim() || null,
  }));

  return (
    <LyricsBooklet
      showId={id}
      titulo={show.casa.nome}
      subtitulo={formatDataBR(show.data, true)}
      songs={songs}
    />
  );
}
