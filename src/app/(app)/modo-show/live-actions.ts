"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { showLive, showPresence, showSuggestion, songs, members, setlistItems } from "@/db/schema";
import { getCurrentUser, isAdmin, type CurrentUser } from "@/lib/auth";
import type { ShowLiveState } from "@/lib/show-live";

const ONLINE_MS = 20_000; // visto nos últimos 20s = online

/** Quem pode controlar o show, dado o modo (§11). Admin/host sempre pode. */
function canControl(mode: string, user: CurrentUser): boolean {
  if (isAdmin(user)) return true;
  if (mode === "all") return true;
  if (mode === "host_members") return !!user.member;
  return false;
}

async function nameOf(memberId: string | null): Promise<string | null> {
  if (!memberId) return null;
  const [m] = await db.select({ nome: members.nome }).from(members).where(eq(members.id, memberId)).limit(1);
  return m?.nome ?? null;
}

async function ensureRow(showId: string) {
  let [row] = await db.select().from(showLive).where(eq(showLive.showId, showId)).limit(1);
  if (!row) {
    await db.insert(showLive).values({ showId }).onConflictDoNothing();
    [row] = await db.select().from(showLive).where(eq(showLive.showId, showId)).limit(1);
  }
  return row;
}

async function bumpVersion(showId: string) {
  const row = await ensureRow(showId);
  await db
    .update(showLive)
    .set({ version: (row?.version ?? 0) + 1, updatedAt: new Date() })
    .where(eq(showLive.showId, showId));
}

async function readState(showId: string): Promise<ShowLiveState> {
  const row = await ensureRow(showId);
  const [updatedByName, maestroName, presRows, sugRows] = await Promise.all([
    nameOf(row?.updatedByMemberId ?? null),
    nameOf(row?.maestroMemberId ?? null),
    db.select().from(showPresence).where(eq(showPresence.showId, showId)),
    db
      .select({ id: showSuggestion.id, songId: showSuggestion.songId, byName: showSuggestion.byName, titulo: songs.titulo })
      .from(showSuggestion)
      .innerJoin(songs, eq(songs.id, showSuggestion.songId))
      .where(and(eq(showSuggestion.showId, showId), eq(showSuggestion.status, "pending")))
      .orderBy(desc(showSuggestion.createdAt))
      .limit(10),
  ]);
  const now = Date.now();
  const presence = presRows
    .map((p) => ({
      memberId: p.memberId,
      nome: p.nome,
      online: now - new Date(p.lastSeenAt).getTime() < ONLINE_MS,
      isMaestro: p.memberId === row?.maestroMemberId,
    }))
    .sort((a, b) => Number(b.online) - Number(a.online) || Number(b.isMaestro) - Number(a.isMaestro));
  return {
    showId,
    currentSongId: row?.currentSongId ?? null,
    controlMode: (row?.controlMode as ShowLiveState["controlMode"]) ?? "host_members",
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).getTime() : 0,
    updatedByName,
    maestroName,
    maestroMemberId: row?.maestroMemberId ?? null,
    presence,
    suggestions: sugRows.map((s) => ({ id: s.id, songId: s.songId, songTitulo: s.titulo, byName: s.byName })),
  };
}

/** Lê (e cria) o estado ao vivo + registra presença (heartbeat, §12). Polling. */
export async function getShowLiveAction(showId: string): Promise<ShowLiveState> {
  const user = await getCurrentUser();
  if (user?.member) {
    const pid = `${showId}:${user.member.id}`;
    await db
      .insert(showPresence)
      .values({ id: pid, showId, memberId: user.member.id, nome: user.member.nome, lastSeenAt: new Date() })
      .onConflictDoUpdate({ target: showPresence.id, set: { lastSeenAt: new Date(), nome: user.member.nome } });
  }
  return readState(showId);
}

/** Define a MÚSICA ATUAL compartilhada (§14). Checa permissão (§11), vira
 *  Maestro (§12) e registra quem alterou (§13). */
export async function setCurrentSongLiveAction(
  showId: string,
  songId: string | null
): Promise<{ ok: boolean; state?: ShowLiveState; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const cur = await readState(showId);
  if (!canControl(cur.controlMode, user)) {
    return { ok: false, error: "Você não tem permissão pra controlar o show." };
  }
  const memberId = user.member?.id ?? null;
  await db
    .update(showLive)
    .set({
      currentSongId: songId,
      version: cur.version + 1,
      updatedByMemberId: memberId,
      maestroMemberId: memberId, // quem age assume o comando (failover natural)
      updatedAt: new Date(),
    })
    .where(eq(showLive.showId, showId));
  return { ok: true, state: await readState(showId) };
}

/** Define quem pode controlar o show (§11) — só host/admin. */
export async function setShowControlModeAction(
  showId: string,
  mode: "host" | "host_members" | "all"
): Promise<{ ok: boolean; state?: ShowLiveState; error?: string }> {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return { ok: false, error: "Só o host/admin muda o modo de controle." };
  await bumpVersion(showId);
  await db.update(showLive).set({ controlMode: mode }).where(eq(showLive.showId, showId));
  return { ok: true, state: await readState(showId) };
}

/** Sugerir a próxima música (§16). Qualquer integrante logado pode. */
export async function suggestSongAction(
  showId: string,
  songId: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const byName = user.member?.nome ?? user.username ?? "Alguém";
  // Evita duplicar a mesma sugestão pendente do mesmo integrante.
  const existing = await db
    .select({ id: showSuggestion.id })
    .from(showSuggestion)
    .where(
      and(
        eq(showSuggestion.showId, showId),
        eq(showSuggestion.songId, songId),
        eq(showSuggestion.status, "pending")
      )
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(showSuggestion).values({
      showId,
      memberId: user.member?.id ?? null,
      byName,
      songId,
      status: "pending",
    });
    await bumpVersion(showId); // pollers dos controladores atualizam logo
  }
  return { ok: true };
}

/** Ordem atual dos itens do setlist (ids, na ordem). Usado no polling do live. */
export async function getSetlistOrderAction(setlistId: string): Promise<string[]> {
  await getCurrentUser();
  const rows = await db
    .select({ id: setlistItems.id })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(asc(setlistItems.ordem));
  return rows.map((r) => r.id);
}

/** Move um item pra cima/baixo no setlist AO VIVO (§15). Sincroniza (bump da
 *  version) e persiste em setlist_items.ordem. Requer permissão de controle. */
export async function moveLiveItemAction(
  showId: string,
  setlistId: string,
  itemId: string,
  dir: -1 | 1
): Promise<{ ok: boolean; order?: string[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const cur = await readState(showId);
  if (!canControl(cur.controlMode, user)) {
    return { ok: false, error: "Você não tem permissão pra reordenar." };
  }
  const rows = await db
    .select({ id: setlistItems.id, ordem: setlistItems.ordem })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(asc(setlistItems.ordem));
  const idx = rows.findIndex((r) => r.id === itemId);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= rows.length) {
    return { ok: true, order: rows.map((r) => r.id) }; // no-op (ponta)
  }
  const a = rows[idx];
  const b = rows[j];
  // Troca os valores de ordem entre os dois vizinhos.
  await db.update(setlistItems).set({ ordem: b.ordem }).where(eq(setlistItems.id, a.id));
  await db.update(setlistItems).set({ ordem: a.ordem }).where(eq(setlistItems.id, b.id));
  await bumpVersion(showId);
  const order = [...rows.map((r) => r.id)];
  [order[idx], order[j]] = [order[j], order[idx]];
  return { ok: true, order };
}

/** Maestro responde a uma sugestão (§16): aceitar (vira música atual) ou ignorar. */
export async function respondSuggestionAction(
  showId: string,
  suggestionId: string,
  accept: boolean
): Promise<{ ok: boolean; state?: ShowLiveState; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const cur = await readState(showId);
  if (!canControl(cur.controlMode, user)) {
    return { ok: false, error: "Sem permissão pra responder sugestões." };
  }
  const [s] = await db.select().from(showSuggestion).where(eq(showSuggestion.id, suggestionId)).limit(1);
  if (!s) return { ok: false, error: "Sugestão não encontrada." };
  await db
    .update(showSuggestion)
    .set({ status: accept ? "accepted" : "ignored" })
    .where(eq(showSuggestion.id, suggestionId));
  if (accept) {
    const memberId = user.member?.id ?? null;
    await db
      .update(showLive)
      .set({
        currentSongId: s.songId,
        version: cur.version + 1,
        updatedByMemberId: memberId,
        maestroMemberId: memberId,
        updatedAt: new Date(),
      })
      .where(eq(showLive.showId, showId));
  } else {
    await bumpVersion(showId);
  }
  return { ok: true, state: await readState(showId) };
}
