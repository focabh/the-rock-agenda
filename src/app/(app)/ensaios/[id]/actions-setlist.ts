"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { setlists, setlistItems, songs } from "@/db/schema";
import { requireSuperuser } from "@/lib/auth";
import { arrangeSetlist } from "@/lib/setlist-arrange";
import { generateEnsaioSetlist } from "@/lib/setlist-generator";

// Setlist de ENSAIO: mesma estrutura do show, mas ligado a um rehearsal e sem
// duração-alvo (ensaio não tem tempo a cumprir).

const rev = (rehearsalId: string) => revalidatePath(`/ensaios/${rehearsalId}`);

export async function createEnsaioSetlistAction(rehearsalId: string, nome: string) {
  await requireSuperuser();
  const [created] = await db
    .insert(setlists)
    .values({ rehearsalId, nome: nome.trim() || "Setlist" })
    .returning();
  rev(rehearsalId);
  return { id: created.id, nome: created.nome };
}

export async function renameEnsaioSetlistAction(rehearsalId: string, setlistId: string, nome: string) {
  await requireSuperuser();
  await db.update(setlists).set({ nome: nome.trim() || "Setlist" }).where(eq(setlists.id, setlistId));
  rev(rehearsalId);
}

export async function deleteEnsaioSetlistAction(rehearsalId: string, setlistId: string) {
  await requireSuperuser();
  await db.delete(setlists).where(eq(setlists.id, setlistId));
  rev(rehearsalId);
}

export async function addSongToEnsaioSetlistAction(rehearsalId: string, setlistId: string, songId: string) {
  await requireSuperuser();
  const last = await db
    .select({ max: sql<number>`coalesce(max(${setlistItems.ordem}), -1)` })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId));
  const nextOrdem = (last[0]?.max ?? -1) + 1;
  await db.insert(setlistItems).values({ setlistId, songId, ordem: nextOrdem });
  rev(rehearsalId);
}

export async function removeEnsaioSetlistItemAction(rehearsalId: string, itemId: string) {
  await requireSuperuser();
  await db.delete(setlistItems).where(eq(setlistItems.id, itemId));
  rev(rehearsalId);
}

export async function updateEnsaioSetlistItemAction(
  rehearsalId: string,
  itemId: string,
  patch: { tom?: string | null; nota?: string | null; prioridade?: boolean; emenda?: boolean }
) {
  await requireSuperuser();
  await db.update(setlistItems).set(patch).where(eq(setlistItems.id, itemId));
  rev(rehearsalId);
}

export async function reorderEnsaioSetlistItemsAction(rehearsalId: string, orderedIds: string[]) {
  await requireSuperuser();
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(setlistItems).set({ ordem: i }).where(eq(setlistItems.id, orderedIds[i]));
    }
  });
  rev(rehearsalId);
}

/** Importa o(s) setlist(s) do show vinculado pro ensaio (copia as músicas). */
export async function importarSetlistDeShowAction(
  rehearsalId: string,
  showId: string
): Promise<{ ok: boolean; setlists: number; musicas: number }> {
  await requireSuperuser();
  const showSetlists = await db.query.setlists.findMany({
    where: eq(setlists.showId, showId),
    with: { items: true },
  });
  let nSets = 0;
  let nMus = 0;
  for (const sl of showSetlists) {
    if (sl.items.length === 0) continue;
    const [novo] = await db.insert(setlists).values({ rehearsalId, nome: sl.nome }).returning();
    const items = [...sl.items].sort((a, b) => a.ordem - b.ordem);
    for (let i = 0; i < items.length; i++) {
      await db.insert(setlistItems).values({
        setlistId: novo.id,
        songId: items[i].songId,
        ordem: i,
        tom: items[i].tom,
        prioridade: items[i].prioridade,
      });
      nMus++;
    }
    nSets++;
  }
  rev(rehearsalId);
  return { ok: true, setlists: nSets, musicas: nMus };
}

/** Gera um setlist de ENSAIO (conceito próprio, sem casa): prioriza músicas
 *  marcadas pra ensaiar + recém-adicionadas, treina as que ainda não estão
 *  prontas, agrupa drops. Grátis (heurística, sem IA). Substitui o set. */
export async function gerarEnsaioSetlistAction(
  rehearsalId: string,
  setlistId: string,
  opts: { targetMin: number; priNovas: boolean; priPesadas: boolean; levesNoComeco: boolean }
): Promise<{ ok: boolean; count: number }> {
  await requireSuperuser();
  const all = await db.select().from(songs);
  const gen = generateEnsaioSetlist(
    all.map((s) => ({
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
      prioridade: s.prioridade,
      createdAtMs: s.createdAt instanceof Date ? s.createdAt.getTime() : 0,
    })),
    {
      targetSeg: Math.max(5, Math.min(600, opts.targetMin)) * 60,
      priNovas: opts.priNovas,
      priPesadas: opts.priPesadas,
      levesNoComeco: opts.levesNoComeco,
      seed: (Date.now() % 2147483647) || 1,
    }
  );
  await db.delete(setlistItems).where(eq(setlistItems.setlistId, setlistId));
  for (let i = 0; i < gen.orderedIds.length; i++) {
    await db.insert(setlistItems).values({ setlistId, songId: gen.orderedIds[i], ordem: i });
  }
  rev(rehearsalId);
  return { ok: true, count: gen.orderedIds.length };
}

/** "Simular show": copia o setlist de um show específico pro setlist de ensaio
 *  (substitui), pra banda ensaiar o set real. Mantém ordem, tom e prioridade. */
export async function simularShowNoEnsaioAction(
  rehearsalId: string,
  setlistId: string,
  showId: string
): Promise<{ ok: boolean; count: number }> {
  await requireSuperuser();
  const showSetlists = await db.query.setlists.findMany({
    where: eq(setlists.showId, showId),
    with: { items: true },
  });
  // Junta os itens de todos os setlists do show, preservando ordem entre eles.
  const allItems = showSetlists
    .flatMap((sl, slIdx) => sl.items.map((it) => ({ ...it, slIdx })))
    .sort((a, b) => (a.slIdx - b.slIdx) || (a.ordem - b.ordem));
  await db.delete(setlistItems).where(eq(setlistItems.setlistId, setlistId));
  for (let i = 0; i < allItems.length; i++) {
    await db.insert(setlistItems).values({
      setlistId,
      songId: allItems[i].songId,
      ordem: i,
      tom: allItems[i].tom,
      prioridade: allItems[i].prioridade,
    });
  }
  rev(rehearsalId);
  return { ok: true, count: allItems.length };
}

/** Reorganiza as músicas atuais numa curva de energia (grátis, sem IA). */
export async function reorganizeEnsaioSetlistAction(
  rehearsalId: string,
  setlistId: string
): Promise<{ ok: boolean; count: number }> {
  await requireSuperuser();
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
