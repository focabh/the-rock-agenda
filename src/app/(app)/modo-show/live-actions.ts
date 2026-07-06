"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { showLive, members } from "@/db/schema";
import { getCurrentUser, isAdmin, type CurrentUser } from "@/lib/auth";
import type { ShowLiveState } from "@/lib/show-live";

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

async function readState(showId: string): Promise<ShowLiveState> {
  let [row] = await db.select().from(showLive).where(eq(showLive.showId, showId)).limit(1);
  if (!row) {
    // Cria o registro compartilhado na 1ª leitura (idempotente em corrida).
    await db.insert(showLive).values({ showId }).onConflictDoNothing();
    [row] = await db.select().from(showLive).where(eq(showLive.showId, showId)).limit(1);
  }
  const [updatedByName, maestroName] = await Promise.all([
    nameOf(row?.updatedByMemberId ?? null),
    nameOf(row?.maestroMemberId ?? null),
  ]);
  return {
    showId,
    currentSongId: row?.currentSongId ?? null,
    controlMode: (row?.controlMode as ShowLiveState["controlMode"]) ?? "host_members",
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).getTime() : 0,
    updatedByName,
    maestroName,
    maestroMemberId: row?.maestroMemberId ?? null,
  };
}

/** Lê (e cria se preciso) o estado ao vivo do show. Usado no polling. */
export async function getShowLiveAction(showId: string): Promise<ShowLiveState> {
  await getCurrentUser();
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
  await readState(showId); // garante o registro
  await db
    .update(showLive)
    .set({ controlMode: mode, version: (await readState(showId)).version + 1, updatedAt: new Date() })
    .where(eq(showLive.showId, showId));
  return { ok: true, state: await readState(showId) };
}
