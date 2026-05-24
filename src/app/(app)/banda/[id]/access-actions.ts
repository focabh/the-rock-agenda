"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, members } from "@/db/schema";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { parseForm, type ActionState } from "@/lib/form";

const accessSchema = z.object({
  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(40)
    .regex(/^[a-z0-9._-]+$/, "Use letras minúsculas, números, . _ -"),
  password: z.string().min(6, "Senha mínima de 6 caracteres").max(100),
  role: z.enum(["admin", "membro"]),
});

export async function createUserForMemberAction(
  memberId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(accessSchema, formData);
  if (!parsed.ok) return parsed.state;

  // garantir que o membro existe e não tem user ainda
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) return { error: "Membro não encontrado." };
  if (member.userId) return { error: "Este membro já tem acesso vinculado." };

  // checar se username já existe
  const existing = await db.query.users.findFirst({
    where: eq(users.username, parsed.data.username),
  });
  if (existing) {
    return {
      fieldErrors: { username: ["Usuário já existe."] },
      error: "Usuário já existe.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .insert(users)
    .values({
      username: parsed.data.username,
      passwordHash,
      role: parsed.data.role,
    })
    .returning();

  await db.update(members).set({ userId: user.id }).where(eq(members.id, memberId));

  revalidatePath(`/banda/${memberId}`);
  revalidatePath("/banda");
  return null;
}

export async function unlinkUserFromMemberAction(memberId: string) {
  await requireAdmin();
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member || !member.userId) return;
  // remove o user (cascata via FK set null no member.userId)
  await db.delete(users).where(eq(users.id, member.userId));
  revalidatePath(`/banda/${memberId}`);
  revalidatePath("/banda");
}
