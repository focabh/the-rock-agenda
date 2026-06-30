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
  venueContacts,
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
  suggestSetlistChanges,
  setlistTotalSeg,
  type SuggestSong,
} from "@/lib/setlist-suggest";
import { arrangeSetlist } from "@/lib/setlist-arrange";
import { fitToTarget, SONG_DEFAULT_SEG } from "@/lib/setlist-fit";
import {
  generateSetlistAI,
  critiqueSetlist,
  critiqueEnsaioSetlist,
  suggestSetlistChangesAI,
  type SetlistCritique,
  type AISuggestSong,
} from "@/lib/setlist-ai";
import { formatHoraBR } from "@/lib/formatters";

export type GenSetlistResult = {
  ok: boolean;
  error?: string;
  count?: number;
  totalSeg?: number;
  targetSeg?: number;
  /** true quando o repertório elegível não chega ao tempo pedido */
  faltou?: boolean;
  /** Quando faltou: clássicos fáceis (4 acordes) pra banda aprender e crescer. */
  sugestoesAprender?: string[];
  via?: "ia" | "heuristica";
};

// Clássicos fáceis (poucos acordes) pra sugerir quando o repertório não enche o
// show. Filtramos os que a banda já tem.
const SUGESTOES_APRENDER = [
  "Zombie — The Cranberries",
  "Iris — Goo Goo Dolls",
  "Song 2 — Blur",
  "Plush — Stone Temple Pilots",
  "In Bloom — Nirvana",
  "Wonderwall — Oasis",
  "Should I Stay or Should I Go — The Clash",
  "Seven Nation Army — The White Stripes",
];

/** Tom (transposição) de UM item do setlist. Colaborativo: qualquer músico
 *  logado pode ajustar (não precisa ser admin). Vale show e ensaio (por itemId). */
export async function setSetlistItemTomAction(
  itemId: string,
  tom: string | null
): Promise<{ ok: boolean }> {
  await requireCurrentUser();
  const v = (tom ?? "").trim().slice(0, 12) || null;
  await db.update(setlistItems).set({ tom: v }).where(eq(setlistItems.id, itemId));
  revalidatePath("/shows", "layout");
  revalidatePath("/ensaios", "layout");
  return { ok: true };
}

// ---------------- SUGESTÕES DE AJUSTE (não-destrutivo) ----------------

export type SetlistSuggestion = {
  kind: "remove" | "add" | "swap";
  reason: string;
  removeItemId?: string;
  removeTitulo?: string;
  addSongId?: string;
  addTitulo?: string;
};

export type SuggestResult = {
  ok: boolean;
  error?: string;
  needsKey?: boolean;
  via?: "ia" | "heuristica";
  suggestions: SetlistSuggestion[];
  totalSeg: number;
  targetMin: number;
};

/**
 * Sugere ajustes no setlist (remover/adicionar/trocar) pra bater o tempo-alvo.
 * `useAI` = considera também o gosto do público (show.publicoPerfil) + tags da
 * casa via Haiku. NÃO aplica nada — a UI oferece "aplicar" por sugestão.
 */
export async function suggestSetlistAction(
  setlistId: string,
  targetMin?: number,
  useAI = false
): Promise<SuggestResult> {
  await requireCurrentUser();
  const sl = await db.query.setlists.findFirst({
    where: eq(setlists.id, setlistId),
    with: { items: { with: { song: true } }, show: { with: { casa: true } } },
  });
  if (!sl) {
    return { ok: false, error: "Setlist não encontrado.", suggestions: [], totalSeg: 0, targetMin: targetMin ?? 60 };
  }

  const items = [...sl.items].sort((a, b) => a.ordem - b.ordem);
  const setSongs: SuggestSong[] = items.map((it) => ({
    songId: it.song.id,
    titulo: it.song.titulo,
    artista: it.song.artista,
    duracaoSeg: it.duracaoSeg ?? it.song.duracaoSeg,
    status: it.song.status,
    energia: it.song.energia,
    favorita: it.song.favorita,
    finalBoss: it.song.finalBoss,
  }));
  const itemBySong = new Map(items.map((it) => [it.song.id, it.id]));
  const inSet = new Set(items.map((it) => it.song.id));

  const allSongs = await db.select().from(songs);
  const pool: SuggestSong[] = allSongs
    .filter((s) => !inSet.has(s.id))
    .map((s) => ({
      songId: s.id,
      titulo: s.titulo,
      artista: s.artista,
      duracaoSeg: s.duracaoSeg,
      status: s.status,
      energia: s.energia,
      favorita: s.favorita,
      finalBoss: s.finalBoss,
    }));

  const totalSeg = setlistTotalSeg(setSongs);
  const effMin =
    targetMin && targetMin > 0
      ? targetMin
      : sl.show?.duracaoMin && sl.show.duracaoMin > 0
        ? sl.show.duracaoMin
        : Math.max(1, Math.round(totalSeg / 60));

  const tituloBySong = new Map(allSongs.map((s) => [s.id, s.titulo]));

  // ---- IA: considera o gosto do público + tags da casa ----
  if (useAI) {
    const toAI = (s: SuggestSong): AISuggestSong => ({
      id: s.songId,
      titulo: s.titulo,
      artista: s.artista,
      duracaoSeg: s.duracaoSeg,
      energia: s.energia,
      status: s.status,
      finalBoss: !!s.finalBoss,
    });
    try {
      const aiRaw = await suggestSetlistChangesAI({
        set: setSongs.map(toAI),
        pool: pool.map(toAI),
        targetMin: effMin,
        publicoPerfil: sl.show?.publicoPerfil ?? "",
        casaTags: parseTags(sl.show?.casa?.caracteristicas),
        privado: !!sl.show?.privado,
      });
      const suggestions: SetlistSuggestion[] = aiRaw.map((s) => {
        if (s.kind === "remove")
          return { kind: "remove", reason: s.reason, removeItemId: itemBySong.get(s.songId), removeTitulo: tituloBySong.get(s.songId) };
        if (s.kind === "add")
          return { kind: "add", reason: s.reason, addSongId: s.songId, addTitulo: tituloBySong.get(s.songId) };
        return {
          kind: "swap",
          reason: s.reason,
          removeItemId: itemBySong.get(s.removeSongId),
          removeTitulo: tituloBySong.get(s.removeSongId),
          addSongId: s.addSongId,
          addTitulo: tituloBySong.get(s.addSongId),
        };
      });
      return { ok: true, via: "ia", suggestions, totalSeg, targetMin: effMin };
    } catch (e) {
      if (e instanceof NoApiKeyError) {
        return { ok: false, needsKey: true, error: "IA não configurada.", suggestions: [], totalSeg, targetMin: effMin };
      }
      return { ok: false, error: "A IA falhou. Tente a sugestão básica.", suggestions: [], totalSeg, targetMin: effMin };
    }
  }

  // ---- Heurística (básica): só tempo + prontidão ----
  const raw = suggestSetlistChanges(setSongs, pool, effMin * 60);
  const suggestions: SetlistSuggestion[] = raw.map((s) => {
    if (s.kind === "remove") {
      return { kind: "remove", reason: s.reason, removeItemId: itemBySong.get(s.songId), removeTitulo: s.titulo };
    }
    if (s.kind === "add") {
      return { kind: "add", reason: s.reason, addSongId: s.songId, addTitulo: s.titulo };
    }
    return {
      kind: "swap",
      reason: s.reason,
      removeItemId: itemBySong.get(s.removeSongId),
      removeTitulo: s.removeTitulo,
      addSongId: s.addSongId,
      addTitulo: s.addTitulo,
    };
  });

  return { ok: true, via: "heuristica", suggestions, totalSeg, targetMin: effMin };
}

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

/** A IA critica a ORDEM atual do setlist (validação humana). Haiku, sem web.
 *  No ENSAIO (opts.ensaio), o foco muda: avalia como as PRIORITÁRIAS (estrela)
 *  se encaixam com o restante (colocação, agrupamento, categoria). */
export async function critiqueSetlistAction(
  setlistId: string,
  opts?: { ensaio?: boolean }
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
      dropada: songs.dropada,
      prioridade: setlistItems.prioridade,
    })
    .from(setlistItems)
    .innerJoin(songs, eq(songs.id, setlistItems.songId))
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(asc(setlistItems.ordem));
  if (items.length === 0) return { ok: false, error: "Setlist vazio." };

  // Ensaio: crítica focada em como as prioritárias se encaixam com o resto.
  if (opts?.ensaio) {
    const totalSegE = items.reduce((t, r) => t + (r.duracaoSeg ?? 210), 0);
    try {
      const crit = await critiqueEnsaioSetlist({
        songs: items.map((r) => ({
          titulo: r.titulo,
          artista: r.artista,
          energia: r.energia,
          conhecida: r.conhecida,
          exigeVocal: r.exigeVocal,
          momento: r.momento,
          finalBoss: r.finalBoss,
          dropada: r.dropada,
          prioridade: r.prioridade,
        })),
        targetMin: Math.round(totalSegE / 60),
      });
      return { ok: true, veredito: crit.veredito, alertas: crit.alertas };
    } catch (e) {
      if (e instanceof NoApiKeyError)
        return { ok: false, needsKey: true, error: e.message };
      return { ok: false, error: e instanceof Error ? e.message : "Falha." };
    }
  }

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

export type StageCuesResult =
  | { ok: true; cues: import("@/lib/stage-cues").StageCue[] }
  | { ok: false; needsKey?: boolean; error: string };

/** Refina os momentos de fala (roteiro de palco) com IA (Haiku). Opcional e sob
 *  confirmação de custo — o roteiro grátis (heurística) já roda sem isto. */
export async function refineStageCuesAction(
  setlistId: string
): Promise<StageCuesResult> {
  await requireCurrentUser();
  const [sl] = await db.select().from(setlists).where(eq(setlists.id, setlistId)).limit(1);
  if (!sl) return { ok: false, error: "Setlist não encontrado." };

  const items = await db
    .select({
      titulo: songs.titulo,
      artista: songs.artista,
      energia: songs.energia,
      momento: songs.momento,
      lyrics: songs.lyrics,
    })
    .from(setlistItems)
    .innerJoin(songs, eq(songs.id, setlistItems.songId))
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(asc(setlistItems.ordem));
  if (items.length === 0) return { ok: false, error: "Setlist vazio." };

  let casaNome: string | null = null;
  let dataEspecial: string | null = null;
  if (sl.showId) {
    const show = await db.query.shows.findFirst({
      where: eq(shows.id, sl.showId),
      with: { casa: { columns: { nome: true } } },
    });
    casaNome = show?.casa?.nome ?? null;
    if (show?.data) {
      const { specialDateLabel } = await import("@/lib/stage-cues");
      dataEspecial = specialDateLabel(show.data.getTime());
    }
  }
  const { getBrand } = await import("@/lib/auth");
  const brand = await getBrand();

  try {
    const { refineStageCuesAI } = await import("@/lib/setlist-ai");
    const cues = await refineStageCuesAI({
      songs: items.map((r) => ({
        titulo: r.titulo,
        artista: r.artista,
        energia: r.energia,
        momento: r.momento,
        temLetra: !!r.lyrics?.trim(),
      })),
      casaNome,
      bandName: brand.bandName,
      redes: null,
      dataEspecial,
    });
    return { ok: true, cues };
  } catch (e) {
    if (e instanceof NoApiKeyError) return { ok: false, needsKey: true, error: e.message };
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
    /** Quando false (padrão), usa o motor gratuito/determinístico — sem custo de IA. */
    usarIA?: boolean;
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
  // Feedback do CRM (regex sobre as mensagens de agradecimento/follow-up).
  const crm = { somBaixo: false, querPeso: false };

  if (show) {
    const [venue] = await db
      .select()
      .from(venues)
      .where(eq(venues.id, show.casaId))
      .limit(1);
    venueTags = parseTags(venue?.caracteristicas);

    // Lê os contatos da casa e procura sinais de volume/peso no texto livre.
    const msgs = await db
      .select({ mensagem: venueContacts.mensagem })
      .from(venueContacts)
      .where(
        and(
          eq(venueContacts.venueId, show.casaId),
          inArray(venueContacts.tipo, ["agradecimento", "followup", "contato"])
        )
      );
    const texto = msgs
      .map((m) => (m.mensagem ?? "").toLowerCase())
      .join(" \n ");
    if (/\b(som mais baix|volume|abaix|baixar o som|mais tranquil|ac[úu]stic|incomod|reclam)/.test(texto))
      crm.somBaixo = true;
    if (/\b(mais peso|pesad|mais forte|porrada|mandar ver|p[úu]blico curtiu o peso|agit|animou)/.test(texto))
      crm.querPeso = true;

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

  // Aprendizado pós-show: campeãs/evitar em casas de perfil parecido.
  let preferIds: string[] = [];
  let penalizeIds: string[] = [];
  if (show) {
    const { getVenueSongInsights } = await import("@/lib/show-learning");
    const ins = await getVenueSongInsights(show.casaId);
    preferIds = ins.campeas.map((c) => c.songId);
    penalizeIds = ins.evitar.map((c) => c.songId);
  }

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

  // 1) Só usa a IA quando o usuário pediu explicitamente (opt-in, custo).
  //    Caso contrário, vai direto pro gerador gratuito/determinístico.
  if (opts.usarIA && process.env.ANTHROPIC_API_KEY && show) {
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
          dropada: s.dropada,
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
        publicoGosto: show.publicoPerfil ?? "",
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
      priPesadas: opts.priPesadas || crm.querPeso,
      priAlternativas: opts.priAlternativas,
      levesNoComeco: opts.levesNoComeco,
      evitarVocalDificil: opts.evitarVocalDificil,
      ordem: opts.ordem,
      evitarRepetir: opts.evitarRepetir,
      avoidIds,
      seed: opts.seed,
      tetoEnergia: crm.somBaixo ? 2 : undefined,
      preferIds,
      penalizeIds,
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
        artista: s.artista,
        dropada: s.dropada,
        popularidade: s.popularidade,
      })),
      genOpts
    );
    orderedIds = result.orderedIds;
    via = "heuristica";
  }

  // 3) Garante o tempo-alvo (completa se faltou, apara se passou).
  const targetSeg = Math.max(1, opts.targetMin) * 60;
  const fit = fitToTarget(
    orderedIds,
    allSongs.map((s) => ({
      id: s.id,
      status: s.status,
      duracaoSeg: s.duracaoSeg,
      energia: s.energia,
      conhecida: s.conhecida,
      finalBoss: s.finalBoss,
    })),
    targetSeg
  );
  orderedIds = fit.ids;

  await db.delete(setlistItems).where(eq(setlistItems.setlistId, setlistId));
  let ordem = 0;
  let totalSeg = 0;
  for (const id of orderedIds) {
    const d = byId.get(id)?.duracaoSeg ?? null;
    totalSeg += d ?? SONG_DEFAULT_SEG;
    await db
      .insert(setlistItems)
      .values({ setlistId, songId: id, ordem: ordem++, duracaoSeg: d });
  }

  // Guarda o racional da IA nas observações do setlist (aparece na impressão).
  await db
    .update(setlists)
    .set({ observacoesGerais: racional || null })
    .where(eq(setlists.id, setlistId));

  // §4: se faltou repertório, sugere clássicos fáceis que a banda ainda não tem.
  let sugestoesAprender: string[] | undefined;
  if (fit.faltou) {
    const titulos = new Set(allSongs.map((s) => s.titulo.toLowerCase()));
    sugestoesAprender = SUGESTOES_APRENDER.filter(
      (s) => !titulos.has(s.split(" — ")[0].toLowerCase())
    ).slice(0, 5);
  }

  revalidatePath(`/shows/${showId}`);
  return {
    ok: true,
    count: orderedIds.length,
    totalSeg,
    targetSeg,
    faltou: fit.faltou,
    sugestoesAprender,
    via,
  };
}

// ---------------- SETLISTS (vários por show) ----------------

/** Revalida a página do dono do setlist (show OU ensaio). */
async function revalidarDonoSetlist(setlistId: string) {
  const [owner] = await db
    .select({ showId: setlists.showId, rehearsalId: setlists.rehearsalId })
    .from(setlists)
    .where(eq(setlists.id, setlistId));
  if (owner?.showId) revalidatePath(`/shows/${owner.showId}`);
  if (owner?.rehearsalId) revalidatePath(`/ensaios/${owner.rehearsalId}`);
}

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

/** Edita nome + duração-alvo (min) do set. duracaoAlvoMin null = usar a do show. */
export async function updateSetlistAction(
  showId: string,
  setlistId: string,
  data: { nome: string; duracaoAlvoMin: number | null }
) {
  await requireAdmin();
  const alvo =
    data.duracaoAlvoMin != null && data.duracaoAlvoMin > 0
      ? Math.min(600, Math.round(data.duracaoAlvoMin))
      : null;
  await db
    .update(setlists)
    .set({ nome: data.nome.trim() || "Setlist", duracaoAlvoMin: alvo })
    .where(eq(setlists.id, setlistId));
  revalidatePath(`/shows/${showId}`);
}

/**
 * "Aplicar melhorias": reorganiza as músicas ATUAIS do set numa curva de
 * energia (abertura → meio ascendente → fechamento → Final Boss). Não adiciona
 * nem remove — só reordena. GRÁTIS (determinístico, sem IA).
 */
export async function reorganizeSetlistAction(
  showId: string,
  setlistId: string
): Promise<{ ok: boolean; count: number }> {
  await requireAdmin();
  const items = await db
    .select({ id: setlistItems.id, songId: setlistItems.songId })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId));
  if (items.length === 0) return { ok: true, count: 0 };

  const songIds = items.map((i) => i.songId);
  const rows = await db.select().from(songs).where(inArray(songs.id, songIds));
  const songById = new Map(rows.map((s) => [s.id, s]));

  const orderedIds = arrangeSetlist(
    items.map((i) => {
      const s = songById.get(i.songId);
      return {
        id: i.songId,
        dropada: s?.dropada ?? false,
        artista: s?.artista ?? "",
        energia: s?.energia ?? null,
        momento: s?.momento ?? "qualquer",
        conhecida: s?.conhecida ?? false,
        finalBoss: s?.finalBoss ?? false,
        popularidade: s?.popularidade ?? null,
      };
    })
  );

  // songId → itemId (set não repete música). Reaplica a ordem.
  const itemBySong = new Map(items.map((i) => [i.songId, i.id]));
  let ordem = 0;
  for (const id of orderedIds) {
    const itemId = itemBySong.get(id);
    if (!itemId) continue;
    await db
      .update(setlistItems)
      .set({ ordem: ordem++ })
      .where(eq(setlistItems.id, itemId));
  }
  revalidatePath(`/shows/${showId}`);
  return { ok: true, count: orderedIds.length };
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
  patch: { tom?: string | null; duracaoSeg?: number | null; nota?: string | null; emenda?: boolean }
) {
  await requireAdmin();
  await db.update(setlistItems).set(patch).where(eq(setlistItems.id, itemId));
  revalidatePath(`/shows/${showId}`);
}

/** Marca um setlist como OFICIAL do show (só 1). Usado pelo Modo Show/flyer. */
export async function setSetlistOficialAction(showId: string, setlistId: string) {
  await requireAdmin();
  await db.update(setlists).set({ oficial: false }).where(eq(setlists.showId, showId));
  await db.update(setlists).set({ oficial: true }).where(eq(setlists.id, setlistId));
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/modo-show");
  return { ok: true };
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

    await revalidarDonoSetlist(setlistId);
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

  await revalidarDonoSetlist(setlistId);
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
