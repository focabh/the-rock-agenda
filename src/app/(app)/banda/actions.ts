"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin } from "@/lib/auth";
import { telefoneValido } from "@/lib/validators";

const memberSchema = z.object({
  nome: z.string().min(1, "Obrigatório").max(120),
  funcao: z.string().min(1, "Obrigatório").max(60),
  telefone: z
    .string()
    .max(40)
    .optional()
    .refine(
      (v) => !v || telefoneValido(v),
      "Telefone inválido — use DDD + número, ex: (31) 99999-9999"
    ),
  equipamentos: z.string().max(1000).optional(),
  disponibilidade: z.string().max(500).optional(),
  percentualDivisao: z.coerce.number().min(0).max(100).optional(),
  observacoes: z.string().max(2000).optional(),
  isManager: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
  avatar: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || v.startsWith("data:image/"),
      "Foto inválida (use imagem)"
    )
    .refine((v) => !v || v.length < 1_500_000, "Foto muito grande"),
  removerAvatar: z.string().optional(),
});

function memberValues(d: z.infer<typeof memberSchema>) {
  // Remove campos auxiliares antes de gravar; trata "remover avatar".
  const { removerAvatar, avatar, ...rest } = d;
  if (removerAvatar === "1") return { ...rest, avatar: null };
  if (avatar) return { ...rest, avatar };
  return rest; // mantém o avatar existente
}

export async function createMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.ok) return parsed.state;
  await db.insert(members).values(memberValues(parsed.data));
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
  await db.update(members).set(memberValues(parsed.data)).where(eq(members.id, id));
  revalidatePath("/banda");
  revalidatePath(`/banda/${id}`);
  redirect("/banda");
}

export async function deleteMemberAction(id: string) {
  await requireAdmin();
  await db.delete(members).where(eq(members.id, id));
  revalidatePath("/banda");
}
