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
import { fetchLyrics } from "@/lib/lyrics";
import { enrichSongsWithAI } from "@/lib/song-ai";
import { NoApiKeyError } from "@/lib/venue-ai";
import { isNull } from "drizzle-orm";

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

const MOMENTOS = ["qualquer", "abertura", "meio", "fechamento"] as const;

/** "3:45" ou "225" → segundos. Vazio/invalid → null. */
function parseDuracao(input: string): number | null {
  const t = (input ?? "").trim();
  if (!t) return null;
  const mmss = t.match(/^(\d+):([0-5]?\d)$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const n = Number(t.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Metadados de setlist vindos do form (campos extras, fora do songSchema). */
function extractSongMeta(fd: FormData) {
  const energia = Number(fd.get("energia"));
  const momentoRaw = String(fd.get("momento") ?? "qualquer");
  return {
    duracaoSeg: parseDuracao(String(fd.get("duracao") ?? "")),
    energia: energia >= 1 && energia <= 3 ? energia : null,
    momento: (MOMENTOS as readonly string[]).includes(momentoRaw)
      ? (momentoRaw as (typeof MOMENTOS)[number])
      : "qualquer",
    conhecida: fd.get("conhecida") === "on",
    exigeVocal: fd.get("exigeVocal") === "on",
    finalBoss: fd.get("finalBoss") === "on",
    tom: String(fd.get("tom") ?? "").trim() || null,
    afinacao: String(fd.get("afinacao") ?? "").trim() || null,
    estilo: String(fd.get("estilo") ?? "").trim() || null,
  };
}

export async function createSongAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(songSchema, formData);
  if (!parsed.ok) return parsed.state;
  await db.insert(songs).values({ ...parsed.data, ...extractSongMeta(formData) });
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
  await db
    .update(songs)
    .set({ ...parsed.data, ...extractSongMeta(formData) })
    .where(eq(songs.id, id));
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
        // Backfill: música já existia sem ID/duração do Spotify → preenche agora.
        const patch: Record<string, string | number> = {};
        if (!found.spotifyTrackId && t.spotifyId) patch.spotifyTrackId = t.spotifyId;
        if (!found.duracaoSeg && t.duracaoSeg) patch.duracaoSeg = t.duracaoSeg;
        if (Object.keys(patch).length)
          await db.update(songs).set(patch).where(eq(songs.id, found.id));
        continue;
      }
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

// ---------------- METADADOS POR IA ----------------

export type EnrichResult = {
  ok: boolean;
  updated?: number;
  total?: number;
  error?: string;
  needsKey?: boolean;
};

/** Preenche energia/conhecida/momento (via IA) das músicas que ainda não têm. */
export async function enrichSongsAIAction(): Promise<EnrichResult> {
  await requireAdmin();
  const pendentes = await db
    .select({ id: songs.id, titulo: songs.titulo, artista: songs.artista })
    .from(songs)
    .where(isNull(songs.energia));
  if (pendentes.length === 0) return { ok: true, updated: 0, total: 0 };

  try {
    const sugestoes = await enrichSongsWithAI(pendentes);
    let updated = 0;
    for (const s of sugestoes) {
      const patch: Record<string, number | boolean | string> = {};
      if (s.energia != null) patch.energia = s.energia;
      if (s.conhecida != null) patch.conhecida = s.conhecida;
      if (s.momento) patch.momento = s.momento;
      if (s.finalBoss != null) patch.finalBoss = s.finalBoss;
      if (Object.keys(patch).length) {
        await db.update(songs).set(patch).where(eq(songs.id, s.id));
        updated++;
      }
    }
    revalidatePath("/repertorio");
    return { ok: true, updated, total: pendentes.length };
  } catch (e) {
    if (e instanceof NoApiKeyError)
      return { ok: false, needsKey: true, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Falha." };
  }
}

// ---------------- LETRAS ----------------

export type SyncLyricsResult = {
  ok: boolean;
  fetched: number;
  alreadyHad: number;
  notFound: number;
  total: number;
};

/**
 * Busca em lote as letras que ainda faltam no repertório (LRCLIB).
 * Concorrência limitada pra ser rápido sem martelar a API nem estourar timeout.
 * O vocal aperta isso e garante tudo cacheado.
 */
export async function syncAllLyricsAction(): Promise<SyncLyricsResult> {
  await requireCurrentUser();
  const all = await db.select().from(songs);

  const pending = all.filter((s) => !s.lyrics || !s.lyrics.trim());
  const alreadyHad = all.length - pending.length;

  let fetched = 0;
  let notFound = 0;

  const CONCURRENCY = 6;
  let i = 0;
  async function worker() {
    while (i < pending.length) {
      const s = pending[i++];
      const lyr = await fetchLyrics(s.titulo, s.artista);
      if (lyr) {
        await db.update(songs).set({ lyrics: lyr }).where(eq(songs.id, s.id));
        fetched++;
      } else {
        notFound++;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker)
  );

  revalidatePath("/repertorio");
  return { ok: true, fetched, alreadyHad, notFound, total: all.length };
}

export type LyricsResult = {
  ok: boolean;
  lyrics: string | null;
  found: boolean;
  error?: string;
};

/**
 * Retorna a letra da música. Se já estiver no banco, usa o cache; senão busca
 * no LRCLIB e salva. Qualquer usuário logado pode ver (o cantor é membro).
 */
export async function getOrFetchLyricsAction(
  songId: string
): Promise<LyricsResult> {
  await requireCurrentUser();
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) return { ok: false, lyrics: null, found: false, error: "Música não encontrada." };

  if (song.lyrics && song.lyrics.trim()) {
    return { ok: true, lyrics: song.lyrics, found: true };
  }

  const fetched = await fetchLyrics(song.titulo, song.artista);
  if (fetched) {
    await db.update(songs).set({ lyrics: fetched }).where(eq(songs.id, songId));
    return { ok: true, lyrics: fetched, found: true };
  }
  return { ok: true, lyrics: null, found: false };
}

/** Admin corrige/cola a letra manualmente (ou limpa, passando string vazia). */
export async function saveLyricsAction(
  songId: string,
  lyrics: string
): Promise<LyricsResult> {
  await requireAdmin();
  const value = lyrics.trim() || null;
  await db.update(songs).set({ lyrics: value }).where(eq(songs.id, songId));
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${songId}`);
  return { ok: true, lyrics: value, found: !!value };
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
