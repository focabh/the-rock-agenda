"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, members, appSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function toggleRegistrationsAction(enabled: boolean) {
  await requireAdmin();
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) {
    await db
      .update(appSettings)
      .set({ allowRegistrations: enabled })
      .where(eq(appSettings.id, row.id));
  } else {
    await db.insert(appSettings).values({ allowRegistrations: enabled });
  }
  revalidatePath("/cadastros");
}

export async function approveUserAction(userId: string) {
  await requireAdmin();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { error: "Usuário não encontrado." };

  await db.update(users).set({ status: "aprovado" }).where(eq(users.id, userId));

  // Cria o músico vinculado, se ainda não houver um
  const [existingMember] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1);
  if (!existingMember) {
    await db.insert(members).values({
      nome: user.nome ?? user.username,
      funcao: "A definir",
      telefone: user.telefone,
      chavePix: user.chavePix,
      userId: user.id,
      ativo: true,
    });
  }

  revalidatePath("/cadastros");
  revalidatePath("/banda");
  return { ok: true };
}

export async function rejectUserAction(userId: string) {
  await requireAdmin();
  await db.update(users).set({ status: "recusado" }).where(eq(users.id, userId));
  revalidatePath("/cadastros");
  return { ok: true };
}
