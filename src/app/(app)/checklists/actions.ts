"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { checklistTemplates, checklistTemplateItems } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin } from "@/lib/auth";

const templateSchema = z.object({
  nome: z.string().min(1, "Obrigatório").max(120),
  descricao: z.string().max(500).optional(),
});

function parseItemsFromForm(formData: FormData): string[] {
  return formData
    .getAll("items")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
}

export async function createTemplateAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(templateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const items = parseItemsFromForm(formData);

  const [tpl] = await db.insert(checklistTemplates).values(parsed.data).returning();
  if (items.length > 0) {
    await db.insert(checklistTemplateItems).values(
      items.map((texto, i) => ({ templateId: tpl.id, texto, ordem: i }))
    );
  }
  revalidatePath("/checklists");
  redirect("/checklists");
}

export async function updateTemplateAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(templateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const items = parseItemsFromForm(formData);

  await db.update(checklistTemplates).set(parsed.data).where(eq(checklistTemplates.id, id));
  // estratégia simples: apaga e reinsere os itens
  await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.templateId, id));
  if (items.length > 0) {
    await db.insert(checklistTemplateItems).values(
      items.map((texto, i) => ({ templateId: id, texto, ordem: i }))
    );
  }
  revalidatePath("/checklists");
  redirect("/checklists");
}

export async function deleteTemplateAction(id: string) {
  await requireAdmin();
  await db.delete(checklistTemplates).where(eq(checklistTemplates.id, id));
  revalidatePath("/checklists");
}
