"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { songs, songMemberReadiness, members, appSettings } from "@/db/schema";
import { and } from "drizzle-orm";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";
import { sendPushToAll } from "@/lib/push";
import {
  extractTrackId,
  fetchTrack,
  fetchTracksPopularity,
} from "@/lib/spotify";
import {
  importPlaylistToRepertorio,
  syncRepertorioFromConfiguredPlaylist,
  type SpotifyImportResult,
} from "@/lib/spotify-sync";
import { parseTracksFromText } from "@/lib/parse-tracks";
import {
  normalizeTitle,
  parseVozPedalTable,
  type VozPedal,
} from "@/lib/voz-pedal";
import {
  getPedalModel,
  getPreset,
  DEFAULT_PEDAL_MODEL,
} from "@/lib/voz-pedais";
import { assignVozPresetsAI } from "@/lib/voz-presets-ai";
import { fetchLyricsFull } from "@/lib/lyrics";
import { fetchBpm } from "@/lib/bpm";
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
const POSICOES_SHOW = ["qualquer", "abertura", "bloco_inicial", "bloco_final", "encerramento"] as const;
type PosicaoShow = (typeof POSICOES_SHOW)[number];

/** A posição (campo único) deriva momento + finalBoss, que o gerador/arranjo já usam. */
function derivarMomentoFinal(pos: PosicaoShow): {
  momento: (typeof MOMENTOS)[number];
  finalBoss: boolean;
} {
  switch (pos) {
    case "abertura":
      return { momento: "abertura", finalBoss: false };
    case "bloco_inicial":
      return { momento: "meio", finalBoss: false };
    case "bloco_final":
      return { momento: "fechamento", finalBoss: false };
    case "encerramento":
      return { momento: "fechamento", finalBoss: true };
    default:
      return { momento: "qualquer", finalBoss: false };
  }
}

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
  const posRaw = String(fd.get("posicaoShow") ?? "qualquer");
  const posicaoShow: PosicaoShow = (POSICOES_SHOW as readonly string[]).includes(posRaw)
    ? (posRaw as PosicaoShow)
    : "qualquer";
  const { momento, finalBoss } = derivarMomentoFinal(posicaoShow);
  // Só presente quando o usuário "puxou do Spotify" no form — caso contrário
  // não tocamos no spotifyTrackId existente.
  const spId = String(fd.get("spotifyTrackId") ?? "").trim();
  return {
    duracaoSeg: parseDuracao(String(fd.get("duracao") ?? "")),
    energia: energia >= 1 && energia <= 3 ? energia : null,
    posicaoShow,
    momento,
    finalBoss,
    conhecida: fd.get("conhecida") === "on",
    exigeVocal: fd.get("exigeVocal") === "on",
    dropada: fd.get("dropada") === "on",
    tom: String(fd.get("tom") ?? "").trim() || null,
    estilo: String(fd.get("estilo") ?? "").trim() || null,
    ...(spId ? { spotifyTrackId: spId } : {}),
  };
}

export type SpotifyTrackPreview =
  | { ok: false; error: string }
  | {
      ok: true;
      titulo: string;
      artista: string;
      duracaoSeg: number;
      spotifyId: string;
    };

/** Lê os dados de UMA faixa do Spotify (sem gravar) pra preencher o form. */
export async function previewSpotifyTrackAction(
  url: string
): Promise<SpotifyTrackPreview> {
  await requireAdmin();
  const trackId = extractTrackId(url);
  if (!trackId) return { ok: false, error: "Cole o link de uma música do Spotify." };
  let track;
  try {
    track = await fetchTrack(trackId);
  } catch {
    track = null;
  }
  if (!track)
    return { ok: false, error: "Não consegui ler essa música. Confira o link." };
  return {
    ok: true,
    titulo: track.titulo,
    artista: track.artista,
    duracaoSeg: track.duracaoSeg,
    spotifyId: track.spotifyId,
  };
}

/**
 * Quando o usuário "puxou do Spotify" (trocou a versão), re-busca letra
 * (LRCLIB, sincronizada) e BPM (GetSongBPM) pelo novo título/artista.
 * Best-effort: só sobrescreve o que encontrar — se não achar, mantém o atual.
 */
async function refreshLyricsAndBpm(
  songId: string,
  titulo: string,
  artista: string,
  spotifyTrackId?: string | null
) {
  try {
    const hit = await fetchLyricsFull(titulo, artista);
    const patch: Record<string, string | number> = {};
    if (hit.plain) patch.lyrics = hit.plain;
    if (hit.synced) patch.syncedLyrics = hit.synced;
    const bpm = await fetchBpm(titulo, artista, spotifyTrackId);
    if (bpm) patch.bpm = bpm;
    if (Object.keys(patch).length)
      await db.update(songs).set(patch).where(eq(songs.id, songId));
  } catch {
    /* best-effort */
  }
}

export async function createSongAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(songSchema, formData);
  if (!parsed.ok) return parsed.state;
  const [created] = await db
    .insert(songs)
    .values({ ...parsed.data, ...extractSongMeta(formData) })
    .returning({ id: songs.id });
  // Puxou do Spotify ao criar → já traz letra + BPM junto.
  const spIdNova = String(formData.get("spotifyTrackId") ?? "").trim();
  if (spIdNova) {
    await refreshLyricsAndBpm(created.id, parsed.data.titulo, parsed.data.artista, spIdNova);
  }
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
  // Puxou do Spotify (trocou a versão) → atualiza letra + BPM também.
  const spIdEdit = String(formData.get("spotifyTrackId") ?? "").trim();
  if (spIdEdit) {
    await refreshLyricsAndBpm(id, parsed.data.titulo, parsed.data.artista, spIdEdit);
  }
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${id}`);
  redirect("/repertorio");
}

export async function deleteSongAction(id: string) {
  await requireAdmin();
  await db.delete(songs).where(eq(songs.id, id));
  revalidatePath("/repertorio");
}

/** Atualiza a popularidade (Spotify) das músicas com spotifyTrackId. R$0 de IA. */
export async function syncSpotifyPopularityAction(): Promise<{
  ok: boolean;
  updated?: number;
  total?: number;
  error?: string;
}> {
  await requireAdmin();
  const all = await db.select().from(songs);
  const withId = all.filter((s) => s.spotifyTrackId);
  if (withId.length === 0)
    return { ok: false, error: "Nenhuma música com ID do Spotify (importe do Spotify primeiro)." };

  const pop = await fetchTracksPopularity(withId.map((s) => s.spotifyTrackId!));
  if (pop.size === 0)
    return {
      ok: false,
      total: withId.length,
      error:
        "O Spotify não retornou popularidade — conecte a conta em Repertório, ou o app está restrito (dev-mode).",
    };

  let updated = 0;
  for (const s of withId) {
    const p = pop.get(s.spotifyTrackId!);
    if (p != null) {
      await db.update(songs).set({ popularidade: p }).where(eq(songs.id, s.id));
      updated++;
    }
  }
  revalidatePath("/repertorio");
  return { ok: true, updated, total: withId.length };
}

/** Importa/sincroniza uma playlist do Spotify (colada) pro repertório. */
export async function importFromSpotifyAction(
  playlistUrl: string
): Promise<SpotifyImportResult> {
  await requireAdmin();
  const r = await importPlaylistToRepertorio(playlistUrl);
  if (r.ok) revalidatePath("/repertorio");
  return r;
}

/** Sincroniza o repertório com a playlist CONFIGURADA do Spotify (Conta › Listas). */
export async function syncRepertorioFromSpotifyAction(): Promise<SpotifyImportResult> {
  await requireAdmin();
  const r = await syncRepertorioFromConfiguredPlaylist();
  if (r.ok) revalidatePath("/repertorio");
  return r;
}

export type AddSongFromSpotifyResult =
  | { ok: false; error: string }
  | { ok: true; id: string; titulo: string; artista: string; already: boolean };

/** Adiciona UMA música ao repertório a partir do link dela no Spotify. */
export async function addSongFromSpotifyAction(
  url: string
): Promise<AddSongFromSpotifyResult> {
  await requireAdmin();
  const trackId = extractTrackId(url);
  if (!trackId) {
    return { ok: false, error: "Cole o link de uma música do Spotify." };
  }
  let track;
  try {
    track = await fetchTrack(trackId);
  } catch {
    track = null;
  }
  if (!track) {
    return {
      ok: false,
      error: "Não consegui ler essa música. Confira o link ou cadastre na mão.",
    };
  }

  // Dedupe por título+artista (mesma regra das outras importações).
  const all = await db.select().from(songs);
  const key = `${track.titulo.toLowerCase()}|${track.artista.toLowerCase()}`;
  const found = all.find(
    (s) => `${s.titulo.toLowerCase()}|${s.artista.toLowerCase()}` === key
  );
  if (found) {
    return {
      ok: true,
      id: found.id,
      titulo: found.titulo,
      artista: found.artista,
      already: true,
    };
  }

  const [created] = await db
    .insert(songs)
    .values({
      titulo: track.titulo,
      artista: track.artista,
      status: "aprendendo",
      spotifyTrackId: track.spotifyId || null,
      duracaoSeg: track.duracaoSeg || null,
    })
    .returning();

  // Best-effort: já puxa letra (sincronizada) + BPM, igual à lista colada.
  try {
    const hit = await fetchLyricsFull(track.titulo, track.artista);
    const patch: Record<string, string | number> = {};
    if (hit.plain) patch.lyrics = hit.plain;
    if (hit.synced) patch.syncedLyrics = hit.synced;
    if (!created.duracaoSeg && hit.durationSec) patch.duracaoSeg = hit.durationSec;
    const bpm = await fetchBpm(track.titulo, track.artista, track.spotifyId);
    if (bpm) patch.bpm = bpm;
    if (Object.keys(patch).length)
      await db.update(songs).set(patch).where(eq(songs.id, created.id));
  } catch {
    /* best-effort */
  }

  revalidatePath("/repertorio");
  return {
    ok: true,
    id: created.id,
    titulo: created.titulo,
    artista: created.artista,
    already: false,
  };
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
  const novos: { id: string; titulo: string; artista: string }[] = [];
  for (const t of parsed) {
    const key = `${t.titulo.toLowerCase()}|${t.artista.toLowerCase()}`;
    if (existingKeys.has(key)) {
      existing++;
      continue;
    }
    const [row] = await db
      .insert(songs)
      .values({ titulo: t.titulo, artista: t.artista, status: "aprendendo" })
      .returning({ id: songs.id });
    novos.push({ id: row.id, titulo: t.titulo, artista: t.artista });
    existingKeys.add(key);
    added++;
  }

  // A lista colada não tem duração. Puxamos do LRCLIB a duração + letra (simples
  // e SINCRONIZADA) das novas — assim o Inteliprompter e a calibração já funcionam.
  let j = 0;
  async function worker() {
    while (j < novos.length) {
      const s = novos[j++];
      try {
        const hit = await fetchLyricsFull(s.titulo, s.artista);
        const patch: Record<string, string | number> = {};
        if (hit.plain) patch.lyrics = hit.plain;
        if (hit.synced) patch.syncedLyrics = hit.synced;
        if (hit.durationSec) patch.duracaoSeg = hit.durationSec;
        const bpm = await fetchBpm(s.titulo, s.artista);
        if (bpm) patch.bpm = bpm;
        if (Object.keys(patch).length) await db.update(songs).set(patch).where(eq(songs.id, s.id));
      } catch {
        /* best-effort */
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, novos.length) }, worker));

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

  // Pendente = falta letra simples OU a sincronizada (que alimenta o Inteliprompter).
  // Letra editada à mão NÃO entra (não sobrescrevemos correção manual).
  const pending = all.filter(
    (s) => !s.lyricsManual && (!s.lyrics?.trim() || !s.syncedLyrics?.trim())
  );
  const alreadyHad = all.length - pending.length;

  let fetched = 0;
  let notFound = 0;

  const CONCURRENCY = 6;
  let i = 0;
  async function worker() {
    while (i < pending.length) {
      const s = pending[i++];
      const hit = await fetchLyricsFull(s.titulo, s.artista);
      const patch: Record<string, string | number> = {};
      if (hit.plain && !s.lyrics?.trim()) patch.lyrics = hit.plain;
      if (hit.synced && !s.syncedLyrics?.trim()) patch.syncedLyrics = hit.synced;
      if (hit.durationSec && !s.duracaoSeg) patch.duracaoSeg = hit.durationSec;
      if (Object.keys(patch).length > 0) {
        await db.update(songs).set(patch).where(eq(songs.id, s.id));
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
  /** Letra editada à mão (protegida da busca automática). */
  manual?: boolean;
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

  // Editada à mão → é a fonte da verdade. NÃO busca nada (não re-introduz a
  // letra sincronizada antiga por cima da correção).
  if (song.lyricsManual) {
    return {
      ok: true,
      lyrics: song.lyrics,
      found: !!song.lyrics?.trim(),
      manual: true,
    };
  }

  // Já tem letra simples no cache → devolve, mas tenta completar a sincronizada
  // e a duração em segundo plano (sem bloquear).
  if (song.lyrics && song.lyrics.trim()) {
    if (!song.syncedLyrics?.trim() || !song.duracaoSeg) {
      const hit = await fetchLyricsFull(song.titulo, song.artista);
      const patch: Record<string, string | number> = {};
      if (hit.synced && !song.syncedLyrics?.trim()) patch.syncedLyrics = hit.synced;
      if (hit.durationSec && !song.duracaoSeg) patch.duracaoSeg = hit.durationSec;
      if (Object.keys(patch).length > 0) await db.update(songs).set(patch).where(eq(songs.id, songId));
    }
    return { ok: true, lyrics: song.lyrics, found: true };
  }

  const hit = await fetchLyricsFull(song.titulo, song.artista);
  if (hit.plain || hit.synced) {
    const patch: Record<string, string | number> = {};
    if (hit.plain) patch.lyrics = hit.plain;
    if (hit.synced) patch.syncedLyrics = hit.synced;
    if (hit.durationSec && !song.duracaoSeg) patch.duracaoSeg = hit.durationSec;
    await db.update(songs).set(patch).where(eq(songs.id, songId));
    return { ok: true, lyrics: hit.plain ?? song.lyrics, found: Boolean(hit.plain) };
  }
  return { ok: true, lyrics: null, found: false };
}

/**
 * Admin corrige/cola a letra manualmente (ou limpa, passando string vazia).
 * Com texto: marca `lyricsManual` (a busca automática não sobrescreve mais) e
 * zera a `syncedLyrics` — a edição vira a versão usada em todo lugar (inclusive
 * o teleprompter, que passa a rolar por velocidade na letra corrigida).
 * Limpando: volta a permitir a busca automática.
 */
export async function saveLyricsAction(
  songId: string,
  lyrics: string
): Promise<LyricsResult> {
  await requireAdmin();
  const value = lyrics.trim() || null;
  await db
    .update(songs)
    .set({ lyrics: value, lyricsManual: !!value, syncedLyrics: null })
    .where(eq(songs.id, songId));
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${songId}`);
  return { ok: true, lyrics: value, found: !!value, manual: !!value };
}

/**
 * Re-busca a letra no LRCLIB e SUBSTITUI a atual (overwrite EXPLÍCITO). Remove o
 * flag de manual e repõe a sincronizada. Usado pelo botão "Re-buscar do LRCLIB".
 */
export async function refetchLyricsAction(songId: string): Promise<LyricsResult> {
  await requireAdmin();
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) return { ok: false, lyrics: null, found: false, error: "Música não encontrada." };
  const hit = await fetchLyricsFull(song.titulo, song.artista);
  if (!hit.plain && !hit.synced) {
    return {
      ok: false,
      lyrics: song.lyrics,
      found: !!song.lyrics?.trim(),
      manual: song.lyricsManual,
      error: "Não encontrei letra no LRCLIB pra essa música.",
    };
  }
  await db
    .update(songs)
    .set({
      lyrics: hit.plain ?? null,
      syncedLyrics: hit.synced ?? null,
      lyricsManual: false,
      ...(hit.durationSec && !song.duracaoSeg ? { duracaoSeg: hit.durationSec } : {}),
    })
    .where(eq(songs.id, songId));
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${songId}`);
  return { ok: true, lyrics: hit.plain ?? null, found: !!hit.plain, manual: false };
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
  const prev = existing?.status ?? null;
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

  // Avisa a banda quando há PROGRESSO real (mudança de nível). Ignora a 1ª
  // marca "aprendendo" (sem progresso) pra não poluir.
  const houveMudanca = status !== prev && !(prev === null && status === "aprendendo");
  if (houveMudanca) {
    try {
      const [mem] = await db.select({ nome: members.nome }).from(members).where(eq(members.id, memberId)).limit(1);
      const [song] = await db.select({ titulo: songs.titulo }).from(songs).where(eq(songs.id, songId)).limit(1);
      const LABEL: Record<string, string> = {
        pronta: "pronta ✅",
        precisa_ensaiar: "precisa ensaiar",
        aprendendo: "aprendendo",
      };
      if (mem && song) {
        await sendPushToAll({
          title: "Progresso no repertório 🎸",
          body: `${mem.nome}: "${song.titulo}" agora está ${LABEL[status] ?? status}.`,
          url: `/repertorio/${songId}`,
          tag: `readiness-${songId}-${memberId}`,
        });
      }
    } catch (e) {
      console.error("push (progresso de música) falhou:", e);
    }
  }
}

/** Salva a config do pedal de voz de uma música (ou limpa, passando null).
 *  Colaborativo: qualquer músico logado pode ajustar (é a config do vocal). */
export async function setSongVozPedalAction(
  id: string,
  pedal: VozPedal | null
): Promise<{ ok: boolean }> {
  await requireCurrentUser();
  let value: string | null = null;
  if (pedal && String(pedal.mode ?? "").trim()) {
    const clean: VozPedal = {
      mode: String(pedal.mode).trim().toUpperCase().slice(0, 8),
      reverb: String(pedal.reverb ?? "").trim().toUpperCase().slice(0, 8),
      level: Math.max(0, Math.min(100, Math.round(Number(pedal.level) || 0))),
    };
    value = JSON.stringify(clean);
  }
  await db.update(songs).set({ vozPedal: value }).where(eq(songs.id, id));
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${id}`);
  revalidatePath("/shows", "layout");
  revalidatePath("/ensaios", "layout");
  return { ok: true };
}

export type VozPedalImportResult = {
  ok: boolean;
  applied: number;
  notMatched: string[];
  error?: string;
};

/** Importa uma tabela colada (Música | Mode | Reverb | Level) casando por
 *  título normalizado. Só atualiza o pedal — não toca em mais nada. */
export async function importVozPedalTableAction(
  text: string
): Promise<VozPedalImportResult> {
  await requireCurrentUser();
  const rows = parseVozPedalTable(text);
  if (rows.length === 0) {
    return { ok: false, applied: 0, notMatched: [], error: "Nenhuma linha válida na tabela." };
  }
  const all = await db.select({ id: songs.id, titulo: songs.titulo }).from(songs);
  const byNorm = new Map(all.map((s) => [normalizeTitle(s.titulo), s.id]));

  let applied = 0;
  const notMatched: string[] = [];
  for (const r of rows) {
    const id = byNorm.get(normalizeTitle(r.titulo));
    if (!id) {
      notMatched.push(r.titulo);
      continue;
    }
    await db
      .update(songs)
      .set({ vozPedal: JSON.stringify(r.pedal) })
      .where(eq(songs.id, id));
    applied++;
  }
  revalidatePath("/repertorio");
  revalidatePath("/shows", "layout");
  revalidatePath("/ensaios", "layout");
  return { ok: true, applied, notMatched };
}

async function getVozPedalModelo(): Promise<string> {
  const [s] = await db.select({ m: appSettings.vozPedalModelo }).from(appSettings).limit(1);
  return s?.m ?? DEFAULT_PEDAL_MODEL;
}

/** Define o preset do pedal de voz de uma música (ou limpa, null). Grava
 *  denormalizado ({preset,nome,slot}) pra exibir sem precisar resolver depois. */
export async function setSongVozPedalPresetAction(
  songId: string,
  presetId: string | null
): Promise<{ ok: boolean }> {
  await requireCurrentUser();
  let value: string | null = null;
  if (presetId) {
    const modelo = await getVozPedalModelo();
    const preset = getPreset(modelo, presetId);
    if (preset)
      value = JSON.stringify({ preset: preset.id, nome: preset.nome, slot: preset.slot });
  }
  await db.update(songs).set({ vozPedal: value }).where(eq(songs.id, songId));
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${songId}`);
  revalidatePath("/shows", "layout");
  revalidatePath("/ensaios", "layout");
  return { ok: true };
}

export type PresetSuggestResult = {
  ok: boolean;
  needsKey?: boolean;
  error?: string;
  applied?: number;
  modeloNome?: string;
};

/** IA mapeia TODO o repertório pros presets do pedal ativo (1 chamada). Maioria
 *  vira "universal"; só foge quando a música pede. Grava denormalizado. */
export async function sugerirPresetsPedalAction(): Promise<PresetSuggestResult> {
  await requireCurrentUser();
  const modelo = await getVozPedalModelo();
  const model = getPedalModel(modelo);
  if (!model) return { ok: false, error: "Nenhum pedal de voz configurado." };

  const rows = await db
    .select({ id: songs.id, titulo: songs.titulo, artista: songs.artista, energia: songs.energia, status: songs.status })
    .from(songs);
  const elig = rows.filter((r) => r.status !== "aposentada");
  if (elig.length === 0) return { ok: false, error: "Sem músicas no repertório." };

  const universal = model.presets.find((p) => p.universal) ?? model.presets[0];
  try {
    const map = await assignVozPresetsAI({
      songs: elig.map((r) => ({ id: r.id, titulo: r.titulo, artista: r.artista, energia: r.energia })),
      presets: model.presets,
      modeloNome: model.nome,
    });
    let applied = 0;
    for (const r of elig) {
      const pid = map[r.id] ?? universal?.id;
      const preset = model.presets.find((p) => p.id === pid) ?? universal;
      if (!preset) continue;
      await db
        .update(songs)
        .set({ vozPedal: JSON.stringify({ preset: preset.id, nome: preset.nome, slot: preset.slot }) })
        .where(eq(songs.id, r.id));
      applied++;
    }
    revalidatePath("/repertorio");
    revalidatePath("/shows", "layout");
    revalidatePath("/ensaios", "layout");
    return { ok: true, applied, modeloNome: model.nome };
  } catch (e) {
    if (e instanceof NoApiKeyError) return { ok: false, needsKey: true, error: "IA não configurada." };
    return { ok: false, error: "A IA falhou ao sugerir os presets." };
  }
}

/** Salva o TOM (transposição) de uma música. Colaborativo: QUALQUER músico
 *  logado pode ajustar (igual BPM). Reflete no repertório e nos setlists. */
export async function setSongTomAction(
  id: string,
  tom: string | null
): Promise<{ ok: boolean; tom: string | null }> {
  await requireCurrentUser();
  const v = (tom ?? "").trim().slice(0, 12) || null;
  await db.update(songs).set({ tom: v }).where(eq(songs.id, id));
  revalidatePath("/repertorio");
  revalidatePath(`/repertorio/${id}`);
  revalidatePath("/shows", "layout");
  revalidatePath("/ensaios", "layout");
  return { ok: true, tom: v };
}

export async function toggleFavoritaAction(id: string, favorita: boolean) {
  await requireAdmin();
  await db.update(songs).set({ favorita }).where(eq(songs.id, id));
  revalidatePath("/repertorio");
}

/** Salva o BPM (andamento) de uma música — usado pelo metrônomo. Qualquer
 *  músico pode salvar (innocuo e colaborativo). null/0 limpa. */
export async function setSongBpmAction(id: string, bpm: number | null) {
  await requireCurrentUser();
  const v = bpm != null && Number.isFinite(bpm) && bpm > 0 ? Math.max(30, Math.min(300, Math.round(bpm))) : null;
  await db.update(songs).set({ bpm: v }).where(eq(songs.id, id));
  revalidatePath("/repertorio");
  return { ok: true, bpm: v };
}

type BpmMiss = { id: string; titulo: string; artista: string };

/** Busca o BPM (GetSongBPM) de todas as músicas que ainda não têm. Devolve as
 *  que NÃO achou (provável cover) pra oferecer "puxar da original". */
export async function fetchBpmAllAction(): Promise<{ atualizadas: number; faltando: BpmMiss[] }> {
  await requireAdmin();
  const rows = await db.select({ id: songs.id, titulo: songs.titulo, artista: songs.artista, bpm: songs.bpm, spotifyTrackId: songs.spotifyTrackId }).from(songs);
  const pend = rows.filter((r) => r.bpm == null);
  const faltando: BpmMiss[] = [];
  let atualizadas = 0;
  let i = 0;
  async function worker() {
    while (i < pend.length) {
      const s = pend[i++];
      const bpm = await fetchBpm(s.titulo, s.artista, s.spotifyTrackId);
      if (bpm) {
        await db.update(songs).set({ bpm }).where(eq(songs.id, s.id));
        atualizadas++;
      } else {
        faltando.push({ id: s.id, titulo: s.titulo, artista: s.artista });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, pend.length) }, worker));
  revalidatePath("/repertorio");
  return { atualizadas, faltando };
}

/** "Puxar da original": tenta o BPM só pelo título (ignora o artista do cover). */
export async function fetchBpmOriginalAction(ids: string[]): Promise<{ atualizadas: number; faltando: BpmMiss[] }> {
  await requireAdmin();
  if (!ids?.length) return { atualizadas: 0, faltando: [] };
  const rows = await db.select({ id: songs.id, titulo: songs.titulo, artista: songs.artista, spotifyTrackId: songs.spotifyTrackId }).from(songs).where(inArray(songs.id, ids));
  const faltando: BpmMiss[] = [];
  let atualizadas = 0;
  let i = 0;
  async function worker() {
    while (i < rows.length) {
      const s = rows[i++];
      // Só pelo título → versão original; ainda assim casa a versão pelo track id.
      const bpm = await fetchBpm(s.titulo, null, s.spotifyTrackId);
      if (bpm) {
        await db.update(songs).set({ bpm }).where(eq(songs.id, s.id));
        atualizadas++;
      } else {
        faltando.push({ id: s.id, titulo: s.titulo, artista: s.artista });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, worker));
  revalidatePath("/repertorio");
  return { atualizadas, faltando };
}

/** Marca/desmarca afinação dropada de uma música (reflete nos setlists). */
/** Salva as marcações (intro/solo) de uma música. */
export async function setSongCuesAction(
  id: string,
  cues: { t: number; label: string }[]
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const clean = (cues ?? [])
    .filter((c) => typeof c.t === "number" && c.label?.trim())
    .map((c) => ({ t: Math.max(0, Math.round(c.t)), label: c.label.trim().slice(0, 60) }))
    .sort((a, b) => a.t - b.t);
  await db.update(songs).set({ cues: clean.length ? JSON.stringify(clean) : null }).where(eq(songs.id, id));
  revalidatePath("/repertorio");
  revalidatePath("/shows", "layout");
  revalidatePath("/ensaios", "layout");
  return { ok: true };
}

/** Sugere marcações a partir da letra sincronizada (vãos = intro/instrumental). */
export async function getSuggestedCuesAction(
  id: string
): Promise<{ ok: boolean; cues: { t: number; label: string }[]; error?: string }> {
  await requireAdmin();
  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) return { ok: false, cues: [], error: "Música não encontrada." };
  const { parseLrc, suggestCues } = await import("@/lib/lrc");
  if (!song.syncedLyrics?.trim()) {
    return { ok: false, cues: [], error: "Essa música não tem letra sincronizada (sincronize as letras primeiro)." };
  }
  return { ok: true, cues: suggestCues(parseLrc(song.syncedLyrics)) };
}

export async function setSongDropAction(id: string, dropada: boolean) {
  // DROP é atributo usado ao montar setlists (que o manager também faz) — admin.
  await requireAdmin();
  await db.update(songs).set({ dropada }).where(eq(songs.id, id));
  revalidatePath("/repertorio");
  revalidatePath("/shows", "layout");
  revalidatePath("/ensaios", "layout");
}

/** Marca/desmarca uma música como prioridade de ensaio (treinar: nova ou pouco
 *  passada). O "Gerar" do ensaio puxa estas pra frente. */
export async function setSongPrioridadeAction(id: string, prioridade: boolean) {
  await requireAdmin();
  await db.update(songs).set({ prioridade }).where(eq(songs.id, id));
  revalidatePath("/repertorio");
  revalidatePath("/ensaios", "layout");
}

/** Verifica o repertório e marca como drop as músicas detectadas (heurística).
 *  Só adiciona (não desmarca) — o admin ajusta manualmente o que quiser. */
export async function verificarDropsAction(): Promise<{ marcadas: number }> {
  await requireAdmin();
  const { isLikelyDrop } = await import("@/lib/drop-detect");
  const rows = await db.select({ id: songs.id, titulo: songs.titulo, artista: songs.artista, dropada: songs.dropada }).from(songs);
  let marcadas = 0;
  for (const s of rows) {
    if (!s.dropada && isLikelyDrop(s.titulo, s.artista)) {
      await db.update(songs).set({ dropada: true }).where(eq(songs.id, s.id));
      marcadas++;
    }
  }
  revalidatePath("/repertorio");
  revalidatePath("/shows", "layout");
  revalidatePath("/ensaios", "layout");
  return { marcadas };
}
