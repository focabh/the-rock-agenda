"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { songs, setlists } from "@/db/schema";
import { requireSuperuser } from "@/lib/auth";
import {
  buildAuthorizeUrl,
  disconnectSpotify,
  spotifyDiagnose,
  SpotifyConfigError,
  type SpotifyDiagnosis,
} from "@/lib/spotify";

const TRACK_URL = (id: string) => `https://open.spotify.com/track/${id}`;

export type SpotifyLinksResult =
  | { ok: true; links: string[]; count: number }
  | { ok: false; error: string };

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

/** Diagnóstico do export: por que o 403 acontece (escopo, conta, erro real). */
export async function diagnoseSpotifyAction(): Promise<SpotifyDiagnosis> {
  await requireSuperuser();
  return spotifyDiagnose();
}

/**
 * Links das faixas de TODO o repertório (músicas com faixa do Spotify), em ordem
 * alfabética. O Spotify bloqueou criar playlist via API em Development Mode
 * (restrição deles desde mai/2025), então a UI copia esses links pra colar num
 * importador (Soundiiz/TuneMyMusic) que cria a playlist. Ver spotify-export-button.
 */
export async function repertorioSpotifyLinksAction(): Promise<SpotifyLinksResult> {
  await requireSuperuser();
  const rows = await db
    .select({ id: songs.spotifyTrackId })
    .from(songs)
    .where(isNotNull(songs.spotifyTrackId))
    .orderBy(asc(songs.titulo));
  const links = rows
    .map((r) => r.id)
    .filter((x): x is string => !!x)
    .map(TRACK_URL);
  if (links.length === 0) {
    return { ok: false, error: "Nenhuma música com faixa do Spotify no repertório." };
  }
  return { ok: true, links, count: links.length };
}

/** Links das faixas de um setlist (show ou ensaio), na ordem do setlist. */
export async function setlistSpotifyLinksAction(
  setlistId: string
): Promise<SpotifyLinksResult> {
  await requireSuperuser();
  const sl = await db.query.setlists.findFirst({
    where: eq(setlists.id, setlistId),
    with: { items: { with: { song: true } } },
  });
  if (!sl) return { ok: false, error: "Setlist não encontrado." };

  const links = [...sl.items]
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => i.song.spotifyTrackId)
    .filter((x): x is string => !!x)
    .map(TRACK_URL);
  if (links.length === 0) {
    return { ok: false, error: "Nenhuma faixa do Spotify neste setlist." };
  }
  return { ok: true, links, count: links.length };
}
