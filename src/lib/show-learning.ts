// Aprendizado pós-show (heurística, grátis): agrega o feedback por música dos
// shows em casas de PERFIL PARECIDO (tags em comum) e sugere o que costuma
// bombar / o que costuma cair. Sem IA → sem custo.

import { inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { shows, venues, songs, showSongFeedback } from "@/db/schema";
import { parseTags } from "@/lib/venue-tags";

export type SongInsight = {
  songId: string;
  titulo: string;
  artista: string;
  publico: number; // nº de shows onde o público curtiu
  banda: number; // nº de shows onde a banda curtiu tocar
  caiu: number; // nº de shows onde caiu/morno
  score: number;
};

export type VenueInsights = {
  campeas: SongInsight[];
  evitar: SongInsight[];
  baseShows: number; // quantos shows (de casas parecidas) entraram na conta
  similares: number; // quantas casas de perfil parecido
};

/** Sugestões pra um show nesta casa, aprendidas de casas com perfil parecido
 *  (compartilham ao menos uma tag). Inclui a própria casa. */
export async function getVenueSongInsights(casaId: string): Promise<VenueInsights> {
  const [alvo] = await db.select().from(venues).where(eq(venues.id, casaId)).limit(1);
  const alvoTags = new Set(parseTags(alvo?.caracteristicas).map((t) => t.toLowerCase()));

  // Casas de perfil parecido: compartilham ao menos uma tag. Sem tags → só a própria.
  const todas = await db
    .select({ id: venues.id, caracteristicas: venues.caracteristicas })
    .from(venues);
  const similaresIds = todas
    .filter((v) => {
      if (v.id === casaId) return true;
      if (alvoTags.size === 0) return false;
      return parseTags(v.caracteristicas).some((t) => alvoTags.has(t.toLowerCase()));
    })
    .map((v) => v.id);

  if (similaresIds.length === 0) {
    return { campeas: [], evitar: [], baseShows: 0, similares: 0 };
  }

  const showRows = await db
    .select({ id: shows.id })
    .from(shows)
    .where(inArray(shows.casaId, similaresIds));
  const showIds = showRows.map((s) => s.id);
  if (showIds.length === 0) {
    return { campeas: [], evitar: [], baseShows: 0, similares: similaresIds.length };
  }

  const fb = await db
    .select({
      songId: showSongFeedback.songId,
      titulo: songs.titulo,
      artista: songs.artista,
      publicoCurtiu: showSongFeedback.publicoCurtiu,
      bandaCurtiu: showSongFeedback.bandaCurtiu,
      caiu: showSongFeedback.caiu,
    })
    .from(showSongFeedback)
    .innerJoin(songs, eq(songs.id, showSongFeedback.songId))
    .where(inArray(showSongFeedback.showId, showIds));

  const agg = new Map<string, SongInsight>();
  for (const r of fb) {
    const cur =
      agg.get(r.songId) ??
      { songId: r.songId, titulo: r.titulo, artista: r.artista, publico: 0, banda: 0, caiu: 0, score: 0 };
    if (r.publicoCurtiu) cur.publico++;
    if (r.bandaCurtiu) cur.banda++;
    if (r.caiu) cur.caiu++;
    agg.set(r.songId, cur);
  }
  for (const s of agg.values()) {
    s.score = s.publico * 2 + s.banda - s.caiu * 2;
  }

  const all = [...agg.values()];
  const campeas = all
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const evitar = all
    .filter((s) => s.caiu > 0 && s.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return { campeas, evitar, baseShows: showIds.length, similares: similaresIds.length };
}
