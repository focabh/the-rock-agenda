"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin } from "@/lib/auth";

const memberSchema = z.object({
  nome: z.string().min(1, "Obrigatório").max(120),
  funcao: z.string().min(1, "Obrigatório").max(60),
  telefone: z.string().max(40).optional(),
  equipamentos: z.string().max(1000).optional(),
  disponibilidade: z.string().max(500).optional(),
  percentualDivisao: z.coerce.number().min(0).max(100).optional(),
  observacoes: z.string().max(2000).optional(),
  isManager: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function createMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.ok) return parsed.state;
  await db.insert(members).values(parsed.data);
  revalidatePath("/banda");
  redirect("/banda");
}

export async function updateMemberAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.ok) return parsed.state;
  await db.update(members).set(parsed.data).where(eq(members.id, id));
  revalidatePath("/banda");
  revalidatePath(`/banda/${id}`);
  redirect("/banda");
}

export async function deleteMemberAction(id: string) {
  await requireAdmin();
  await db.delete(members).where(eq(members.id, id));
  revalidatePath("/banda");
}
