import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { formatDataBR } from "@/lib/formatters";
import { LyricsBooklet } from "./lyrics-booklet";

export default async function LetrasPage({
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
      backHref={`/shows/${id}`}
      docxHref={`/shows/${id}/letras/docx${setlist?.id ? `?sl=${setlist.id}` : ""}`}
      titulo={show.casa.nome}
      subtitulo={`${formatDataBR(show.data, true)}${
        setlist?.nome ? ` · ${setlist.nome}` : ""
      }`}
      songs={songs}
    />
  );
}
