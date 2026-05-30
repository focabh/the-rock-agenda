"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { songs, songMemberReadiness } from "@/db/schema";
import { and } from "drizzle-orm";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";
import {
  SpotifyConfigError,
  extractPlaylistId,
  fetchPlaylistTracks,
} from "@/lib/spotify";
import { parseTracksFromText } from "@/lib/parse-tracks";

const SONG_STATUSES = [
  "pronta",
  "precisa_ensaiar",
  "aprendendo",
  "ideia_futura",
  "aposentada",
] as const;

const songSchema = z.object({
  titulo: z.string().min(1, "Obrigatório").max(200),
  artista: z.string().min(1, "Obrigatório").max(120),
  status: z.enum(SONG_STATUSES),
  observacoes: z.string().max(500).optional(),
});

export async function createSongAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(songSchema, formData);
  if (!parsed.ok) return parsed.state;
  await db.insert(songs).values(parsed.data);
  revalidatePath("/repertorio");
  redirect("/repertorio");
}

export async function updateSongAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(songSchema, formData);
  if (!parsed.ok) return parsed.state;
  await db.update(songs).set(parsed.data).where(eq(songs.id, id));
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${id}`);
  redirect("/repertorio");
}

export async function deleteSongAction(id: string) {
  await requireAdmin();
  await db.delete(songs).where(eq(songs.id, id));
  revalidatePath("/repertorio");
}

export type SpotifyImportResult = {
  ok: boolean;
  error?: string;
  added?: number;
  existing?: number;
  total?: number;
};

export async function importFromSpotifyAction(
  playlistUrl: string
): Promise<SpotifyImportResult> {
  await requireAdmin();
  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) {
    return { ok: false, error: "URL ou ID do Spotify inválido." };
  }

  try {
    const tracks = await fetchPlaylistTracks(playlistId);
    const all = await db.select().from(songs);
    const byKey = new Map(
      all.map((s) => [
        `${s.titulo.toLowerCase()}|${s.artista.toLowerCase()}`,
        s,
      ])
    );

    let added = 0;
    let existing = 0;
    for (const t of tracks) {
      const key = `${t.titulo.toLowerCase()}|${t.artista.toLowerCase()}`;
      const found = byKey.get(key);
      if (found) {
        existing++;
        // Backfill: música já existia sem o ID do Spotify → preenche agora.
        if (!found.spotifyTrackId && t.spotifyId) {
          await db
            .update(songs)
            .set({ spotifyTrackId: t.spotifyId })
            .where(eq(songs.id, found.id));
        }
        continue;
      }
      const [created] = await db
        .insert(songs)
        .values({
          titulo: t.titulo,
          artista: t.artista,
          status: "aprendendo",
          spotifyTrackId: t.spotifyId || null,
        })
        .returning();
      byKey.set(key, created);
      added++;
    }
    revalidatePath("/repertorio");
    return { ok: true, added, existing, total: tracks.length };
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

export async function importPastedToRepertorioAction(
  text: string
): Promise<SpotifyImportResult> {
  await requireAdmin();
  const parsed = parseTracksFromText(text);
  if (parsed.length === 0) {
    return { ok: false, error: "Nenhuma música encontrada no texto." };
  }
  const all = await db.select().from(songs);
  const existingKeys = new Set(
    all.map((s) => `${s.titulo.toLowerCase()}|${s.artista.toLowerCase()}`)
  );
  let added = 0;
  let existing = 0;
  for (const t of parsed) {
    const key = `${t.titulo.toLowerCase()}|${t.artista.toLowerCase()}`;
    if (existingKeys.has(key)) {
      existing++;
      continue;
    }
    await db.insert(songs).values({
      titulo: t.titulo,
      artista: t.artista,
      status: "aprendendo",
    });
    existingKeys.add(key);
    added++;
  }
  revalidatePath("/repertorio");
  return { ok: true, added, existing, total: parsed.length };
}

// ---------------- AÇÕES EM MASSA ----------------

export type BulkResult = { ok: boolean; count?: number; error?: string };

export async function bulkDeleteSongsAction(
  ids: string[]
): Promise<BulkResult> {
  await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "Nada selecionado." };
  await db.delete(songs).where(inArray(songs.id, ids));
  revalidatePath("/repertorio");
  return { ok: true, count: ids.length };
}

export async function bulkSetStatusAction(
  ids: string[],
  status: (typeof SONG_STATUSES)[number]
): Promise<BulkResult> {
  await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "Nada selecionado." };
  if (!SONG_STATUSES.includes(status)) {
    return { ok: false, error: "Status inválido." };
  }
  await db.update(songs).set({ status }).where(inArray(songs.id, ids));
  revalidatePath("/repertorio");
  return { ok: true, count: ids.length };
}

export async function bulkSetFavoritaAction(
  ids: string[],
  favorita: boolean
): Promise<BulkResult> {
  await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "Nada selecionado." };
  await db.update(songs).set({ favorita }).where(inArray(songs.id, ids));
  revalidatePath("/repertorio");
  return { ok: true, count: ids.length };
}

export async function setMemberReadinessAction(
  songId: string,
  memberId: string,
  status: "pronta" | "precisa_ensaiar" | "aprendendo"
) {
  const user = await requireCurrentUser();
  // Admin marca a prontidão de qualquer músico; membro só a própria.
  if (user.role !== "admin" && user.member?.id !== memberId) {
    return { error: "Você só pode marcar a sua própria prontidão." };
  }
  const existing = await db.query.songMemberReadiness.findFirst({
    where: and(
      eq(songMemberReadiness.songId, songId),
      eq(songMemberReadiness.memberId, memberId)
    ),
  });
  if (existing) {
    await db
      .update(songMemberReadiness)
      .set({ status })
      .where(eq(songMemberReadiness.id, existing.id));
  } else {
    await db.insert(songMemberReadiness).values({ songId, memberId, status });
  }
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${songId}`);
}

export async function toggleFavoritaAction(id: string, favorita: boolean) {
  await requireAdmin();
  await db.update(songs).set({ favorita }).where(eq(songs.id, id));
  revalidatePath("/repertorio");
}
