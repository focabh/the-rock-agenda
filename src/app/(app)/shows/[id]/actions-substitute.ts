"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { showSubstitute } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

const subSchema = z.object({
  nome: z.string().min(1, "Informe o nome do sub").max(120),
  contato: z.string().max(40).optional(),
  funcao: z.string().max(60).optional(),
  forMemberId: z.string().max(40).optional(),
});

export async function createSubstituteAction(
  showId: string,
  data: { nome: string; contato?: string; funcao?: string; forMemberId?: string }
) {
  await requireAdmin();
  const parsed = subSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  await db.insert(showSubstitute).values({
    showId,
    nome: parsed.data.nome.trim(),
    contato: parsed.data.contato?.trim() || null,
    funcao: parsed.data.funcao?.trim() || null,
    forMemberId: parsed.data.forMemberId || null,
  });
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

export async function deleteSubstituteAction(showId: string, subId: string) {
  await requireAdmin();
  await db.delete(showSubstitute).where(eq(showSubstitute.id, subId));
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}
