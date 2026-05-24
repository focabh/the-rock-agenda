"use server";

import { revalidatePath } from "next/cache";
import { eq, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import {
  showChecklists,
  showChecklistItems,
  checklistTemplates,
  checklistTemplateItems,
} from "@/db/schema";

export async function applyChecklistTemplateAction(
  showId: string,
  templateId: string
) {
  await requireAdmin();
  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, templateId),
  });
  if (!template) return;
  const items = await db
    .select()
    .from(checklistTemplateItems)
    .where(eq(checklistTemplateItems.templateId, templateId))
    .orderBy(asc(checklistTemplateItems.ordem));

  const [sc] = await db
    .insert(showChecklists)
    .values({ showId, templateId })
    .returning();

  if (items.length > 0) {
    await db.insert(showChecklistItems).values(
      items.map((it) => ({
        showChecklistId: sc.id,
        texto: it.texto,
        ordem: it.ordem,
        concluido: false,
      }))
    );
  }
  revalidatePath(`/shows/${showId}`);
}

export async function toggleChecklistItemAction(
  showId: string,
  itemId: string,
  concluido: boolean
) {
  await db
    .update(showChecklistItems)
    .set({ concluido, concluidoEm: concluido ? new Date() : null })
    .where(eq(showChecklistItems.id, itemId));
  revalidatePath(`/shows/${showId}`);
}

export async function addChecklistItemAction(
  showId: string,
  showChecklistId: string,
  texto: string
) {
  await requireAdmin();
  if (!texto.trim()) return;
  const max = await db
    .select({ m: sql<number>`coalesce(max(${showChecklistItems.ordem}), -1)` })
    .from(showChecklistItems)
    .where(eq(showChecklistItems.showChecklistId, showChecklistId));
  await db.insert(showChecklistItems).values({
    showChecklistId,
    texto: texto.trim(),
    ordem: (max[0]?.m ?? -1) + 1,
    concluido: false,
  });
  revalidatePath(`/shows/${showId}`);
}

export async function removeChecklistItemAction(showId: string, itemId: string) {
  await requireAdmin();
  await db.delete(showChecklistItems).where(eq(showChecklistItems.id, itemId));
  revalidatePath(`/shows/${showId}`);
}

export async function removeShowChecklistAction(showId: string, scId: string) {
  await requireAdmin();
  await db.delete(showChecklists).where(eq(showChecklists.id, scId));
  revalidatePath(`/shows/${showId}`);
}
