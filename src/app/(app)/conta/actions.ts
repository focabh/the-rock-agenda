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
import { pixValido, telefoneValido } from "@/lib/validators";

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

/** Define o nome da banda e o link do grupo no WhatsApp. (Os fundos têm ação própria.) */
export async function setBrandAction(
  bandName: string,
  whatsappGrupo = "",
  whatsappGrupoMusicos = ""
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const name = bandName.trim().slice(0, 80) || null;
  const grupo = whatsappGrupo.trim().slice(0, 300) || null;
  const grupoMusicos = whatsappGrupoMusicos.trim().slice(0, 300) || null;
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) {
    await db.update(appSettings).set({ bandName: name, whatsappGrupo: grupo, whatsappGrupoMusicos: grupoMusicos }).where(eq(appSettings.id, row.id));
  } else {
    await db.insert(appSettings).values({ bandName: name, whatsappGrupo: grupo, whatsappGrupoMusicos: grupoMusicos });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const ALLOWED_BG = /^data:image\/(png|jpe?g|webp);base64,/;

/** Salva o fundo do LOGIN (kind="login") ou o fundo GERAL do app (kind="app"). */
export async function setBackgroundAction(
  kind: "login" | "app",
  dataUrl: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const u = dataUrl.trim();
  if (!ALLOWED_BG.test(u)) return { ok: false, error: "Use JPG, PNG ou WebP." };
  if (u.length > 4_000_000) return { ok: false, error: "Imagem muito grande." };
  const patch = kind === "app" ? { appBackgroundUrl: u } : { backgroundUrl: u };
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) await db.update(appSettings).set(patch).where(eq(appSettings.id, row.id));
  else await db.insert(appSettings).values(patch);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove o fundo do login ou do app. */
export async function removeBackgroundAction(kind: "login" | "app"): Promise<{ ok: boolean }> {
  await requireAdmin();
  const patch = kind === "app" ? { appBackgroundUrl: null } : { backgroundUrl: null };
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) await db.update(appSettings).set(patch).where(eq(appSettings.id, row.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Liga/desliga: admin também vê só o material da sua posição (esconde letras). */
export async function setAdminMaterialPorPosicaoAction(value: boolean) {
  await requireAdmin();
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) {
    await db
      .update(appSettings)
      .set({ adminMaterialPorPosicao: value })
      .where(eq(appSettings.id, row.id));
  } else {
    await db.insert(appSettings).values({ adminMaterialPorPosicao: value });
  }
  revalidatePath("/repertorio");
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
  posicao: z.string().trim().min(1, "Escolha sua posição"),
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
      fieldErrors: { posicao: ["Posição inválida"] },
      error: "Posição inválida.",
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

const optionalAvatar = z
  .string()
  .trim()
  .optional()
  .refine(
    (v) => !v || v.startsWith("data:image/"),
    "Foto inválida (use imagem)"
  )
  .refine(
    (v) => !v || v.length < 1_500_000,
    "Foto muito grande, escolha uma menor"
  );

const updateMemberSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(120),
  telefone: optionalTelefone,
  chavePix: optionalPix,
  pixTipo: z.string().trim().max(20).optional(),
  pixBanco: z.string().trim().max(60).optional(),
  avatar: optionalAvatar,
  removerAvatar: z.string().optional(),
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
  const { nome, telefone, chavePix, pixTipo, pixBanco, avatar, removerAvatar } = parsed.data;
  const update: Record<string, unknown> = {
    nome,
    telefone,
    chavePix,
    pixTipo: pixTipo || null,
    pixBanco: pixBanco || null,
  };
  if (removerAvatar === "1") update.avatar = null;
  else if (avatar) update.avatar = avatar;
  await db.update(members).set(update).where(eq(members.id, user.member.id));
  revalidatePath("/conta");
  revalidatePath("/banda");
  revalidatePath(`/banda/${user.member.id}`);
  return { success: true };
}
