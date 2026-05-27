"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, members, appSettings } from "@/db/schema";
import { hashPassword, requireAdmin } from "@/lib/auth";

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

  const fullName =
    [user.nome, user.sobrenome].filter(Boolean).join(" ") || user.username;

  // Vincula ao músico existente daquela posição (sem login ainda); senão cria
  const candidates = await db
    .select()
    .from(members)
    .where(and(eq(members.ativo, true), isNull(members.userId)));
  const match = user.posicao
    ? candidates.find(
        (m) => m.funcao.toLowerCase() === user.posicao!.toLowerCase()
      )
    : undefined;

  if (match) {
    await db
      .update(members)
      .set({
        userId: user.id,
        nome: fullName,
        telefone: user.telefone ?? match.telefone,
        chavePix: user.chavePix ?? match.chavePix,
      })
      .where(eq(members.id, match.id));
  } else {
    const [already] = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);
    if (!already) {
      await db.insert(members).values({
        nome: fullName,
        funcao: user.posicao ?? "A definir",
        telefone: user.telefone,
        chavePix: user.chavePix,
        userId: user.id,
        ativo: true,
      });
    }
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

export async function resetUserPasswordAction(userId: string, novaSenha: string) {
  await requireAdmin();
  if (!novaSenha || novaSenha.length < 6) {
    return { error: "A senha precisa ter ao menos 6 caracteres." };
  }
  const hash = await hashPassword(novaSenha);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));
  return { ok: true };
}

export async function setUserRoleAction(userId: string, role: "admin" | "membro") {
  const me = await requireAdmin();
  if (me.id === userId && role !== "admin") {
    return { error: "Você não pode remover o seu próprio acesso de admin." };
  }
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/cadastros");
  return { ok: true };
}
