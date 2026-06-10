"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { songs, setlists } from "@/db/schema";
import { requireSuperuser } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import {
  buildAuthorizeUrl,
  disconnectSpotify,
  exportTracksToPlaylist,
  SpotifyConfigError,
  type ExportResult,
} from "@/lib/spotify";

const STATE_COOKIE = "spotify_oauth_state";

export async function connectSpotifyAction() {
  await requireSuperuser();
  let url: string;
  try {
    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
    url = buildAuthorizeUrl(state);
  } catch (err) {
    if (err instanceof SpotifyConfigError) {
      redirect(`/repertorio?spotify=naoconfig`);
    }
    throw err;
  }
  redirect(url);
}

export async function disconnectSpotifyAction() {
  await requireSuperuser();
  await disconnectSpotify();
  revalidatePath("/repertorio");
}

/** Exporta TODO o repertório (músicas com faixa do Spotify) → playlist pública
 *  "The Rock - <data de hoje>". */
export async function exportRepertorioToSpotifyAction(): Promise<ExportResult> {
  await requireSuperuser();
  const rows = await db
    .select({ id: songs.spotifyTrackId })
    .from(songs)
    .where(isNotNull(songs.spotifyTrackId))
    .orderBy(asc(songs.titulo));
  const trackIds = rows.map((r) => r.id).filter((x): x is string => !!x);
  return exportTracksToPlaylist({
    name: `The Rock - ${formatDataBR(new Date())}`,
    description: "Repertório da banda The Rock — exportado pelo StageBoss.",
    trackIds,
  });
}

/** Exporta um setlist (show ou ensaio) → playlist pública. Nome = nome do show
 *  (casa · data) ou "The Rock — Ensaio · data". */
export async function exportSetlistToSpotifyAction(
  setlistId: string
): Promise<ExportResult> {
  await requireSuperuser();
  const sl = await db.query.setlists.findFirst({
    where: eq(setlists.id, setlistId),
    with: {
      items: { with: { song: true } },
      show: { with: { casa: true } },
      rehearsal: true,
    },
  });
  if (!sl) return { ok: false, error: "Setlist não encontrado." };

  const trackIds = [...sl.items]
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => i.song.spotifyTrackId)
    .filter((x): x is string => !!x);

  let name: string;
  if (sl.show) name = `${sl.show.casa.nome} — ${formatDataBR(sl.show.data)}`;
  else if (sl.rehearsal) name = `The Rock — Ensaio · ${formatDataBR(sl.rehearsal.data)}`;
  else name = `The Rock — ${sl.nome}`;

  return exportTracksToPlaylist({
    name,
    description: `Setlist "${sl.nome}" — The Rock (via StageBoss).`,
    trackIds,
  });
}
