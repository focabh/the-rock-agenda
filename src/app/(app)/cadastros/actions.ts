"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, inviteTokens } from "@/db/schema";
import { getAvailablePositions, hashPassword, requireAdmin } from "@/lib/auth";
import { generateInviteToken, INVITE_TTL_MS } from "@/lib/invites";
import { telefoneValido, maskPhone } from "@/lib/validators";

/**
 * Gera um convite amarrado a um telefone. Retorna o token — o link
 * (/cadastro?invite=TOKEN) é montado no cliente com a origin correta.
 * `posicao` é opcional: se vier, trava a posição no cadastro.
 */
export async function createInviteAction(
  nome: string,
  telefone: string,
  posicao?: string
) {
  const me = await requireAdmin();

  const tel = maskPhone(telefone);
  if (!telefoneValido(tel)) {
    return { error: "Telefone inválido — use DDD + número, ex: (31) 99999-9999." };
  }

  const pos = (posicao ?? "").trim();
  if (pos) {
    const available = await getAvailablePositions();
    if (!available.some((p) => p.toLowerCase() === pos.toLowerCase())) {
      return { error: "Posição inválida." };
    }
  }

  const token = generateInviteToken();
  await db.insert(inviteTokens).values({
    token,
    telefone: tel,
    nome: nome.trim() || null,
    posicao: pos || null,
    expiresEm: new Date(Date.now() + INVITE_TTL_MS),
    createdBy: me.id,
  });

  revalidatePath("/cadastros");
  return { ok: true, token, telefone: tel, nome: nome.trim() || null };
}

export async function revokeInviteAction(inviteId: string) {
  await requireAdmin();
  await db
    .update(inviteTokens)
    .set({ revokedEm: new Date() })
    .where(eq(inviteTokens.id, inviteId));
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
