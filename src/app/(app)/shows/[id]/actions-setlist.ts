"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, lt, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  setlists,
  setlistItems,
  songs,
  shows,
  venues,
  bandSetlistPrefs,
} from "@/db/schema";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";
import { computeSetlistMemory } from "@/lib/setlist-memory";
import { NoApiKeyError } from "@/lib/venue-ai";
import {
  SpotifyConfigError,
  extractPlaylistId,
  fetchPlaylistTracks,
} from "@/lib/spotify";
import { parseTracksFromText } from "@/lib/parse-tracks";
import { parseTags } from "@/lib/venue-tags";
import { generateSetlist, type GenOptions } from "@/lib/setlist-generator";
import {
  generateSetlistAI,
  critiqueSetlist,
  type SetlistCritique,
} from "@/lib/setlist-ai";
import { formatHoraBR } from "@/lib/formatters";

export type GenSetlistResult = {
  ok: boolean;
  error?: string;
  count?: number;
  totalSeg?: number;
  via?: "ia" | "heuristica";
};

// ---------------- PREFERÊNCIAS FIXAS DA BANDA (memória explícita) ----------------

export async function getSetlistPrefsAction(): Promise<{ regras: string }> {
  await requireCurrentUser();
  const [row] = await db.select().from(bandSetlistPrefs).limit(1);
  return { regras: row?.regras ?? "" };
}

export async function saveSetlistPrefsAction(
  regras: string
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const value = regras.trim().slice(0, 2000) || null;
  const [row] = await db.select().from(bandSetlistPrefs).limit(1);
  if (row) {
    await db
      .update(bandSetlistPrefs)
      .set({ regras: value })
      .where(eq(bandSetlistPrefs.id, row.id));
  } else {
    await db.insert(bandSetlistPrefs).values({ regras: value });
  }
  return { ok: true };
}

export type CritiqueResult = {
  ok: boolean;
  veredito?: SetlistCritique["veredito"];
  alertas?: string[];
  error?: string;
  needsKey?: boolean;
};

/** A IA critica a ORDEM atual do setlist (validação humana). Haiku, sem web. */
export async function critiqueSetlistAction(
  setlistId: string
): Promise<CritiqueResult> {
  await requireCurrentUser();
  const [sl] = await db
    .select()
    .from(setlists)
    .where(eq(setlists.id, setlistId))
    .limit(1);
  if (!sl) return { ok: false, error: "Setlist não encontrado." };

  const items = await db
    .select({
      titulo: songs.titulo,
      artista: songs.artista,
      energia: songs.energia,
      conhecida: songs.conhecida,
      exigeVocal: songs.exigeVocal,
      momento: songs.momento,
      finalBoss: songs.finalBoss,
      duracaoSeg: songs.duracaoSeg,
    })
    .from(setlistItems)
    .innerJoin(songs, eq(songs.id, setlistItems.songId))
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(asc(setlistItems.ordem));
  if (items.length === 0) return { ok: false, error: "Setlist vazio." };

  let diaSemana = "";
  let casaTags: string[] = [];
  if (sl.showId) {
    const [show] = await db
      .select()
      .from(shows)
      .where(eq(shows.id, sl.showId))
      .limit(1);
    if (show) {
      diaSemana = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "long",
      }).format(show.data);
      const [v] = await db
        .select()
        .from(venues)
        .where(eq(venues.id, show.casaId))
        .limit(1);
      casaTags = parseTags(v?.caracteristicas);
    }
  }
  const totalSeg = items.reduce((t, r) => t + (r.duracaoSeg ?? 210), 0);

  try {
    const crit = await critiqueSetlist({
      songs: items.map((r) => ({
        titulo: r.titulo,
        artista: r.artista,
        energia: r.energia,
        conhecida: r.conhecida,
        exigeVocal: r.exigeVocal,
        momento: r.momento,
        finalBoss: r.finalBoss,
      })),
      targetMin: Math.round(totalSeg / 60),
      diaSemana,
      casaTags,
    });
    return { ok: true, veredito: crit.veredito, alertas: crit.alertas };
  } catch (e) {
    if (e instanceof NoApiKeyError)
      return { ok: false, needsKey: true, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Falha." };
  }
}

/** Gera (substitui) o setlist com base na casa + duração + opções. Sugestão. */
export async function generateSetlistAction(
  showId: string,
  setlistId: string,
  opts: {
    targetMin: number;
    priConhecidas: boolean;
    priPesadas: boolean;
    priAlternativas: boolean;
    levesNoComeco: boolean;
    evitarVocalDificil: boolean;
    ordem: "equilibrada" | "aleatoria";
    evitarRepetir: boolean;
    perfilDesejado?: string;
    seed: number;
  }
): Promise<GenSetlistResult> {
  await requireAdmin();

  const allSongs = await db.select().from(songs);
  if (allSongs.length === 0)
    return { ok: false, error: "Repertório vazio — cadastre músicas primeiro." };

  const [show] = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
  let venueTags: string[] = [];
  let avoidIds: string[] = [];

  if (show) {
    const [venue] = await db
      .select()
      .from(venues)
      .where(eq(venues.id, show.casaId))
      .limit(1);
    venueTags = parseTags(venue?.caracteristicas);

    if (opts.evitarRepetir) {
      const casaShows = await db
        .select({ id: shows.id })
        .from(shows)
        .where(eq(shows.casaId, show.casaId));
      const otherShowIds = casaShows.map((s) => s.id).filter((sid) => sid !== showId);
      if (otherShowIds.length) {
        const sls = await db
          .select({ id: setlists.id })
          .from(setlists)
          .where(inArray(setlists.showId, otherShowIds));
        const slIds = sls.map((x) => x.id);
        if (slIds.length) {
          const items = await db
            .select({ songId: setlistItems.songId })
            .from(setlistItems)
            .where(inArray(setlistItems.setlistId, slIds));
          avoidIds = [...new Set(items.map((i) => i.songId))];
        }
      }
    }
  }

  const byId = new Map(allSongs.map((s) => [s.id, s]));

  // Memória: aprende abre/fecha dos setlists já salvos + regras fixas da banda.
  const allItems = await db
    .select({
      setlistId: setlistItems.setlistId,
      songId: setlistItems.songId,
      ordem: setlistItems.ordem,
    })
    .from(setlistItems);
  const mem = computeSetlistMemory(allItems);
  const memAberturas = mem.aberturas
    .map((id) => byId.get(id)?.titulo)
    .filter((t): t is string => !!t);
  const memFechamentos = mem.fechamentos
    .map((id) => byId.get(id)?.titulo)
    .filter((t): t is string => !!t);
  const [prefsRow] = await db.select().from(bandSetlistPrefs).limit(1);
  const regras = prefsRow?.regras ?? "";

  let orderedIds: string[] = [];
  let via: "ia" | "heuristica" = "heuristica";
  let racional = "";

  // 1) Tenta a IA (curva de energia + respiros + contexto). Se faltar chave ou
  //    falhar, cai no gerador heurístico determinístico.
  if (process.env.ANTHROPIC_API_KEY && show) {
    try {
      const diaSemana = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "long",
      }).format(show.data);
      const horario = show.inicio || formatHoraBR(show.data);
      const setlistAnterior = opts.evitarRepetir
        ? allSongs.filter((s) => avoidIds.includes(s.id)).map((s) => s.titulo)
        : [];

      const ai = await generateSetlistAI({
        songs: allSongs.map((s) => ({
          id: s.id,
          titulo: s.titulo,
          artista: s.artista,
          duracaoSeg: s.duracaoSeg,
          energia: s.energia,
          conhecida: s.conhecida,
          exigeVocal: s.exigeVocal,
          momento: s.momento,
          tom: s.tom,
          finalBoss: s.finalBoss,
        })),
        targetMin: Math.max(1, opts.targetMin),
        diaSemana,
        horario,
        casaNome: show ? "esta casa" : "",
        casaPerfil: "",
        casaTags: venueTags,
        setlistAnterior,
        regras,
        perfilDesejado: opts.perfilDesejado ?? "equilibrado",
        memoriaAberturas: memAberturas,
        memoriaFechamentos: memFechamentos,
        prefs: {
          priConhecidas: opts.priConhecidas,
          priPesadas: opts.priPesadas,
          priAlternativas: opts.priAlternativas,
          levesNoComeco: opts.levesNoComeco,
          evitarVocalDificil: opts.evitarVocalDificil,
        },
      });
      orderedIds = ai.orderedIds;
      racional = ai.racional;
      via = "ia";
    } catch {
      // silencioso — usa o heurístico
    }
  }

  // 2) Fallback heurístico
  if (orderedIds.length === 0) {
    const genOpts: GenOptions = {
      targetSeg: Math.max(1, opts.targetMin) * 60,
      venueTags,
      priConhecidas: opts.priConhecidas,
      priPesadas: opts.priPesadas,
      priAlternativas: opts.priAlternativas,
      levesNoComeco: opts.levesNoComeco,
      evitarVocalDificil: opts.evitarVocalDificil,
      ordem: opts.ordem,
      evitarRepetir: opts.evitarRepetir,
      avoidIds,
      seed: opts.seed,
    };
    const result = generateSetlist(
      allSongs.map((s) => ({
        id: s.id,
        status: s.status,
        duracaoSeg: s.duracaoSeg,
        energia: s.energia,
        conhecida: s.conhecida,
        exigeVocal: s.exigeVocal,
        momento: s.momento,
        finalBoss: s.finalBoss,
      })),
      genOpts
    );
    orderedIds = result.orderedIds;
    via = "heuristica";
  }

  await db.delete(setlistItems).where(eq(setlistItems.setlistId, setlistId));
  let ordem = 0;
  let totalSeg = 0;
  for (const id of orderedIds) {
    const d = byId.get(id)?.duracaoSeg ?? null;
    totalSeg += d ?? 210;
    await db
      .insert(setlistItems)
      .values({ setlistId, songId: id, ordem: ordem++, duracaoSeg: d });
  }

  // Guarda o racional da IA nas observações do setlist (aparece na impressão).
  await db
    .update(setlists)
    .set({ observacoesGerais: racional || null })
    .where(eq(setlists.id, setlistId));

  revalidatePath(`/shows/${showId}`);
  return { ok: true, count: orderedIds.length, totalSeg, via };
}

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
