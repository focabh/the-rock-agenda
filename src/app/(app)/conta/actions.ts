"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, members, appSettings } from "@/db/schema";
import {
  getAvailablePositions,
  hashPassword,
  requireAdmin,
  requireCurrentUser,
  verifyPassword,
} from "@/lib/auth";
import { parseForm } from "@/lib/form";
import { POSICOES, pixValido, telefoneValido } from "@/lib/validators";

const profileSchema = z.object({
  apelido: z.string().trim().max(60).optional(),
  nome: z.string().trim().min(1, "Informe seu nome").max(80),
  sobrenome: z.string().trim().min(1, "Informe seu sobrenome").max(80),
});

const passwordSchema = z
  .object({
    atual: z.string().min(1, "Informe a senha atual"),
    nova: z.string().min(6, "Mínimo 6 caracteres").max(100),
    confirmar: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.nova === d.confirmar, {
    path: ["confirmar"],
    message: "As senhas não conferem",
  });

export type AccountState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | null;

export async function updateProfileAction(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const user = await requireCurrentUser();
  const parsed = parseForm(profileSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { apelido, nome, sobrenome } = parsed.data;

  await db
    .update(users)
    .set({
      apelido: apelido && apelido.length > 0 ? apelido : null,
      nome,
      sobrenome,
    })
    .where(eq(users.id, user.id));

  // Se há músico vinculado, sincroniza o nome dele com o apelido (preferido)
  // ou com "nome sobrenome", pra que a Banda/Repartição/Presença reflitam tudo.
  if (user.member) {
    const memberNome =
      apelido && apelido.length > 0 ? apelido : `${nome} ${sobrenome}`.trim();
    await db
      .update(members)
      .set({ nome: memberNome })
      .where(eq(members.id, user.member.id));
    revalidatePath(`/banda/${user.member.id}`);
  }

  revalidatePath("/conta");
  revalidatePath("/");
  return { success: true };
}

export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const user = await requireCurrentUser();
  const parsed = parseForm(passwordSchema, formData);
  if (!parsed.ok) return parsed.state;

  const ok = await verifyPassword(parsed.data.atual, user.passwordHash);
  if (!ok) {
    return {
      fieldErrors: { atual: ["Senha atual incorreta"] },
      error: "Senha atual incorreta.",
    };
  }

  const hash = await hashPassword(parsed.data.nova);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id));
  return { success: true };
}

const ALLOWED_LOGO = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/;

export async function saveLogoAction(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  await requireAdmin();
  const logo = String(formData.get("logo") ?? "");
  if (!ALLOWED_LOGO.test(logo)) {
    return { error: "Imagem inválida. Use PNG, JPG, WEBP ou SVG." };
  }
  if (logo.length > 900_000) {
    return { error: "Imagem muito grande. Tente uma menor." };
  }
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) {
    await db
      .update(appSettings)
      .set({ logoUrl: logo })
      .where(eq(appSettings.id, row.id));
  } else {
    await db.insert(appSettings).values({ logoUrl: logo });
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeLogoAction() {
  await requireAdmin();
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) {
    await db
      .update(appSettings)
      .set({ logoUrl: null })
      .where(eq(appSettings.id, row.id));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const optionalTelefone = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || telefoneValido(v), "Telefone inválido");
const optionalPix = z
  .string()
  .trim()
  .max(200)
  .optional()
  .refine((v) => !v || pixValido(v), "Chave PIX inválida");

const linkSchema = z.object({
  nome: z.string().trim().max(120).optional(),
  posicao: z.enum(POSICOES),
  telefone: optionalTelefone,
  chavePix: optionalPix,
});

/** Vincula o usuário logado a um músico (posição). Usado pra o admin virar músico também. */
export async function linkSelfToPositionAction(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const user = await requireCurrentUser();
  if (user.member) {
    return { error: "Você já está vinculado a um músico." };
  }
  const parsed = parseForm(linkSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { nome, posicao, telefone, chavePix } = parsed.data;

  const available = await getAvailablePositions();
  if (!available.some((p) => p.toLowerCase() === posicao.toLowerCase())) {
    return {
      fieldErrors: { posicao: ["Essa posição já está ocupada"] },
      error: "Posição indisponível.",
    };
  }

  // Reaproveita o músico existente daquela posição (sem login), senão cria
  const candidates = await db
    .select()
    .from(members)
    .where(and(eq(members.ativo, true), isNull(members.userId)));
  const match = candidates.find(
    (m) => m.funcao.toLowerCase() === posicao.toLowerCase()
  );
  if (match) {
    await db
      .update(members)
      .set({
        userId: user.id,
        nome: nome ?? match.nome,
        telefone: telefone ?? match.telefone,
        chavePix: chavePix ?? match.chavePix,
      })
      .where(eq(members.id, match.id));
  } else {
    await db.insert(members).values({
      nome: nome ?? user.nome ?? user.username,
      funcao: posicao,
      telefone,
      chavePix,
      userId: user.id,
      ativo: true,
    });
  }

  await db
    .update(users)
    .set({
      posicao,
      telefone: telefone ?? user.telefone,
      chavePix: chavePix ?? user.chavePix,
    })
    .where(eq(users.id, user.id));

  revalidatePath("/conta");
  revalidatePath("/banda");
  revalidatePath("/");
  return { success: true };
}

const updateMemberSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(120),
  telefone: optionalTelefone,
  chavePix: optionalPix,
});

/** Edita os próprios dados de músico (telefone/CPF/PIX/nome). */
export async function updateMyMemberAction(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const user = await requireCurrentUser();
  if (!user.member) {
    return { error: "Você não está vinculado a um músico." };
  }
  const parsed = parseForm(updateMemberSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { nome, telefone, chavePix } = parsed.data;
  await db
    .update(members)
    .set({ nome, telefone, chavePix })
    .where(eq(members.id, user.member.id));
  revalidatePath("/conta");
  revalidatePath("/banda");
  return { success: true };
}
