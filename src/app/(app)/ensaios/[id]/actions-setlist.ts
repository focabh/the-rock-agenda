"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { setlists, setlistItems, songs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { arrangeSetlist } from "@/lib/setlist-arrange";

// Setlist de ENSAIO: mesma estrutura do show, mas ligado a um rehearsal e sem
// duração-alvo (ensaio não tem tempo a cumprir).

const rev = (rehearsalId: string) => revalidatePath(`/ensaios/${rehearsalId}`);

export async function createEnsaioSetlistAction(rehearsalId: string, nome: string) {
  await requireAdmin();
  const [created] = await db
    .insert(setlists)
    .values({ rehearsalId, nome: nome.trim() || "Setlist" })
    .returning();
  rev(rehearsalId);
  return { id: created.id, nome: created.nome };
}

export async function renameEnsaioSetlistAction(rehearsalId: string, setlistId: string, nome: string) {
  await requireAdmin();
  await db.update(setlists).set({ nome: nome.trim() || "Setlist" }).where(eq(setlists.id, setlistId));
  rev(rehearsalId);
}

export async function deleteEnsaioSetlistAction(rehearsalId: string, setlistId: string) {
  await requireAdmin();
  await db.delete(setlists).where(eq(setlists.id, setlistId));
  rev(rehearsalId);
}

export async function addSongToEnsaioSetlistAction(rehearsalId: string, setlistId: string, songId: string) {
  await requireAdmin();
  const last = await db
    .select({ max: sql<number>`coalesce(max(${setlistItems.ordem}), -1)` })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId));
  const nextOrdem = (last[0]?.max ?? -1) + 1;
  await db.insert(setlistItems).values({ setlistId, songId, ordem: nextOrdem });
  rev(rehearsalId);
}

export async function removeEnsaioSetlistItemAction(rehearsalId: string, itemId: string) {
  await requireAdmin();
  await db.delete(setlistItems).where(eq(setlistItems.id, itemId));
  rev(rehearsalId);
}

export async function updateEnsaioSetlistItemAction(
  rehearsalId: string,
  itemId: string,
  patch: { tom?: string | null; nota?: string | null; prioridade?: boolean }
) {
  await requireAdmin();
  await db.update(setlistItems).set(patch).where(eq(setlistItems.id, itemId));
  rev(rehearsalId);
}

export async function reorderEnsaioSetlistItemsAction(rehearsalId: string, orderedIds: string[]) {
  await requireAdmin();
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(setlistItems).set({ ordem: i }).where(eq(setlistItems.id, orderedIds[i]));
    }
  });
  rev(rehearsalId);
}

/** Reorganiza as músicas atuais numa curva de energia (grátis, sem IA). */
export async function reorganizeEnsaioSetlistAction(
  rehearsalId: string,
  setlistId: string
): Promise<{ ok: boolean; count: number }> {
  await requireAdmin();
  const items = await db
    .select({ id: setlistItems.id, songId: setlistItems.songId })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId));
  if (items.length === 0) return { ok: true, count: 0 };

  const rows = await db.select().from(songs).where(inArray(songs.id, items.map((i) => i.songId)));
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

  const itemBySong = new Map(items.map((i) => [i.songId, i.id]));
  let ordem = 0;
  for (const id of orderedIds) {
    const itemId = itemBySong.get(id);
    if (!itemId) continue;
    await db.update(setlistItems).set({ ordem: ordem++ }).where(eq(setlistItems.id, itemId));
  }
  rev(rehearsalId);
  return { ok: true, count: orderedIds.length };
}
