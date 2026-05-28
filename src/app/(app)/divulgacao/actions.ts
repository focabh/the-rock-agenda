"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { promoItems } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin } from "@/lib/auth";

const TIPOS = ["video", "foto", "logo", "presskit"] as const;

const schema = z.object({
  tipo: z.enum(TIPOS),
  titulo: z.string().trim().min(2, "Informe um título").max(120),
  url: z
    .string()
    .trim()
    .url("URL inválida (use http:// ou https://)")
    .max(500),
  descricao: z.string().trim().max(500).optional(),
});

export async function createPromoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  await db.insert(promoItems).values({
    tipo: parsed.data.tipo,
    titulo: parsed.data.titulo,
    url: parsed.data.url,
    descricao: parsed.data.descricao,
  });
  revalidatePath("/divulgacao");
  return null;
}

export async function updatePromoAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  await db
    .update(promoItems)
    .set({
      tipo: parsed.data.tipo,
      titulo: parsed.data.titulo,
      url: parsed.data.url,
      descricao: parsed.data.descricao,
    })
    .where(eq(promoItems.id, id));
  revalidatePath("/divulgacao");
  return null;
}

export async function deletePromoAction(id: string) {
  await requireAdmin();
  await db.delete(promoItems).where(eq(promoItems.id, id));
  revalidatePath("/divulgacao");
}
