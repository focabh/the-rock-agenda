"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, lt, desc, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { setlists, setlistItems, songs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  SpotifyConfigError,
  extractPlaylistId,
  fetchPlaylistTracks,
} from "@/lib/spotify";
import { parseTracksFromText } from "@/lib/parse-tracks";

// ---------------- SETLISTS (vários por show) ----------------

export async function createSetlistAction(showId: string, nome: string) {
  await requireAdmin();
  const [created] = await db
    .insert(setlists)
    .values({ showId, nome: nome.trim() || "Setlist" })
    .returning();
  revalidatePath(`/shows/${showId}`);
  return { id: created.id, nome: created.nome };
}

export async function renameSetlistAction(
  showId: string,
  setlistId: string,
  nome: string
) {
  await requireAdmin();
  await db
    .update(setlists)
    .set({ nome: nome.trim() || "Setlist" })
    .where(eq(setlists.id, setlistId));
  revalidatePath(`/shows/${showId}`);
}

export async function deleteSetlistAction(showId: string, setlistId: string) {
  await requireAdmin();
  await db.delete(setlists).where(eq(setlists.id, setlistId));
  revalidatePath(`/shows/${showId}`);
}

// ---------------- ITENS DO SETLIST ----------------

export async function addSongToSetlistAction(
  showId: string,
  setlistId: string,
  songId: string
) {
  await requireAdmin();
  const last = await db
    .select({ max: sql<number>`coalesce(max(${setlistItems.ordem}), -1)` })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId));
  const nextOrdem = (last[0]?.max ?? -1) + 1;
  await db
    .insert(setlistItems)
    .values({ setlistId, songId, ordem: nextOrdem });
  revalidatePath(`/shows/${showId}`);
}

export async function removeSetlistItemAction(showId: string, itemId: string) {
  await requireAdmin();
  await db.delete(setlistItems).where(eq(setlistItems.id, itemId));
  revalidatePath(`/shows/${showId}`);
}

export async function updateSetlistItemAction(
  showId: string,
  itemId: string,
  patch: { tom?: string | null; duracaoSeg?: number | null; nota?: string | null }
) {
  await requireAdmin();
  await db.update(setlistItems).set(patch).where(eq(setlistItems.id, itemId));
  revalidatePath(`/shows/${showId}`);
}

export async function reorderSetlistItemsAction(
  showId: string,
  orderedIds: string[]
) {
  await requireAdmin();
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(setlistItems)
        .set({ ordem: i })
        .where(eq(setlistItems.id, orderedIds[i]));
    }
  });
  revalidatePath(`/shows/${showId}`);
}

export type SpotifyToSetlistResult = {
  ok: boolean;
  error?: string;
  added?: number;
  duplicados?: number;
  songsCriadas?: number;
  total?: number;
};

export async function importPlaylistToSetlistAction(
  showId: string,
  setlistId: string,
  playlistUrl: string,
  replace: boolean
): Promise<SpotifyToSetlistResult> {
  await requireAdmin();
  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) {
    return { ok: false, error: "URL ou ID do Spotify inválido." };
  }

  try {
    const tracks = await fetchPlaylistTracks(playlistId);

    if (replace) {
      await db.delete(setlistItems).where(eq(setlistItems.setlistId, setlistId));
    }

    const allSongs = await db.select().from(songs);
    const songByKey = new Map(
      allSongs.map((s) => [
        `${s.titulo.toLowerCase()}|${s.artista.toLowerCase()}`,
        s,
      ])
    );

    const currentItems = replace
      ? []
      : await db
          .select()
          .from(setlistItems)
          .where(eq(setlistItems.setlistId, setlistId));
    const usedSongIds = new Set(currentItems.map((i) => i.songId));
    let nextOrdem =
      currentItems.length > 0
        ? Math.max(...currentItems.map((i) => i.ordem)) + 1
        : 0;

    let added = 0;
    let duplicados = 0;
    let songsCriadas = 0;

    for (const t of tracks) {
      const key = `${t.titulo.toLowerCase()}|${t.artista.toLowerCase()}`;
      let song = songByKey.get(key);
      if (!song) {
        const [created] = await db
          .insert(songs)
          .values({
            titulo: t.titulo,
            artista: t.artista,
            status: "aprendendo",
            spotifyTrackId: t.spotifyId || null,
            duracaoSeg: t.duracaoSeg || null,
          })
          .returning();
        songByKey.set(key, created);
        song = created;
        songsCriadas++;
      } else {
        const patch: Record<string, string | number> = {};
        if (!song.spotifyTrackId && t.spotifyId) patch.spotifyTrackId = t.spotifyId;
        if (!song.duracaoSeg && t.duracaoSeg) patch.duracaoSeg = t.duracaoSeg;
        if (Object.keys(patch).length)
          await db.update(songs).set(patch).where(eq(songs.id, song.id));
      }
      if (usedSongIds.has(song.id)) {
        duplicados++;
        continue;
      }
      await db.insert(setlistItems).values({
        setlistId,
        songId: song.id,
        ordem: nextOrdem++,
        duracaoSeg: t.duracaoSeg,
      });
      usedSongIds.add(song.id);
      added++;
    }

    revalidatePath(`/shows/${showId}`);
    revalidatePath("/repertorio");
    return {
      ok: true,
      added,
      duplicados,
      songsCriadas,
      total: tracks.length,
    };
  } catch (err) {
    const message =
      err instanceof SpotifyConfigError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Erro desconhecido ao importar.";
    return { ok: false, error: message };
  }
}

export async function importPastedToSetlistAction(
  showId: string,
  setlistId: string,
  text: string,
  replace: boolean
): Promise<SpotifyToSetlistResult> {
  await requireAdmin();
  const parsed = parseTracksFromText(text);
  if (parsed.length === 0) {
    return { ok: false, error: "Nenhuma música encontrada no texto." };
  }

  if (replace) {
    await db.delete(setlistItems).where(eq(setlistItems.setlistId, setlistId));
  }

  const allSongs = await db.select().from(songs);
  const songByKey = new Map(
    allSongs.map((s) => [
      `${s.titulo.toLowerCase()}|${s.artista.toLowerCase()}`,
      s,
    ])
  );

  const currentItems = replace
    ? []
    : await db
        .select()
        .from(setlistItems)
        .where(eq(setlistItems.setlistId, setlistId));
  const usedSongIds = new Set(currentItems.map((i) => i.songId));
  let nextOrdem =
    currentItems.length > 0
      ? Math.max(...currentItems.map((i) => i.ordem)) + 1
      : 0;

  let added = 0;
  let duplicados = 0;
  let songsCriadas = 0;

  for (const t of parsed) {
    const key = `${t.titulo.toLowerCase()}|${t.artista.toLowerCase()}`;
    let song = songByKey.get(key);
    if (!song) {
      const [created] = await db
        .insert(songs)
        .values({
          titulo: t.titulo,
          artista: t.artista,
          status: "aprendendo",
        })
        .returning();
      songByKey.set(key, created);
      song = created;
      songsCriadas++;
    }
    if (usedSongIds.has(song.id)) {
      duplicados++;
      continue;
    }
    await db.insert(setlistItems).values({
      setlistId,
      songId: song.id,
      ordem: nextOrdem++,
    });
    usedSongIds.add(song.id);
    added++;
  }

  revalidatePath(`/shows/${showId}`);
  revalidatePath("/repertorio");
  return { ok: true, added, duplicados, songsCriadas, total: parsed.length };
}

export async function moveSetlistItemAction(
  showId: string,
  itemId: string,
  direction: "up" | "down"
) {
  await requireAdmin();
  const [item] = await db
    .select()
    .from(setlistItems)
    .where(eq(setlistItems.id, itemId))
    .limit(1);
  if (!item) return;

  const neighbor = await db
    .select()
    .from(setlistItems)
    .where(
      and(
        eq(setlistItems.setlistId, item.setlistId),
        direction === "up"
          ? lt(setlistItems.ordem, item.ordem)
          : gt(setlistItems.ordem, item.ordem)
      )
    )
    .orderBy(direction === "up" ? desc(setlistItems.ordem) : asc(setlistItems.ordem))
    .limit(1);

  if (neighbor.length === 0) return;
  const other = neighbor[0];

  await db.transaction(async (tx) => {
    await tx
      .update(setlistItems)
      .set({ ordem: -1 })
      .where(eq(setlistItems.id, item.id));
    await tx
      .update(setlistItems)
      .set({ ordem: item.ordem })
      .where(eq(setlistItems.id, other.id));
    await tx
      .update(setlistItems)
      .set({ ordem: other.ordem })
      .where(eq(setlistItems.id, item.id));
  });

  revalidatePath(`/shows/${showId}`);
}
