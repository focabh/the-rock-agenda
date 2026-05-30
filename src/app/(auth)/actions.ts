"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, members, inviteTokens } from "@/db/schema";
import {
  getAvailablePositions,
  getSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { parseForm } from "@/lib/form";
import { getValidInvite, samePhone } from "@/lib/invites";
import { sendPushToAdmins } from "@/lib/push";
import { pixValido, telefoneValido } from "@/lib/validators";

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const ident = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!ident || !password) {
    return { error: "Preencha usuário/email e senha." };
  }

  // Aceita login por usuário OU email (case-insensitive)
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.username, ident), sql`lower(${users.email}) = ${ident}`))
    .limit(1);
  if (!user) return { error: "Usuário ou senha inválidos." };

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { error: "Usuário ou senha inválidos." };

  if (user.status === "pendente") {
    return { error: "Seu cadastro está aguardando aprovação do administrador." };
  }
  if (user.status === "recusado") {
    return { error: "Seu cadastro não foi aprovado. Fale com o administrador." };
  }

  const session = await getSession();
  session.authed = true;
  session.username = user.username;
  await session.save();

  redirect("/");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

const registerSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(80),
  sobrenome: z.string().trim().min(2, "Informe seu sobrenome").max(80),
  email: z.string().trim().email("Email inválido (ex: nome@email.com)").max(160),
  username: z
    .string()
    .trim()
    .min(3, "Use pelo menos 3 caracteres")
    .max(40, "Máximo 40 caracteres")
    .regex(/^[a-z0-9._-]+$/, "Use só letras minúsculas, números, ponto, underline ou hífen"),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres").max(100),
  telefone: z
    .string()
    .trim()
    .refine(telefoneValido, "Telefone inválido — use DDD + número, ex: (31) 99999-9999"),
  chavePix: z
    .string()
    .trim()
    .max(200)
    .refine(pixValido, "Chave PIX inválida — pode ser CPF, telefone, email ou chave aleatória"),
  posicao: z
    .string()
    .trim()
    .min(1, "Escolha sua posição na banda"),
  inviteToken: z.string().trim().min(1, "Convite ausente"),
});

/** Checagem leve usada no blur do campo "usuário" — não consome login. */
export async function checkUsernameAction(username: string) {
  const u = username.trim().toLowerCase();
  if (u.length < 3) return { ok: true, taken: false };
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, u))
    .limit(1);
  return { ok: true, taken: Boolean(row) };
}

export type RegisterState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
} | null;

export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = parseForm(registerSchema, formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  // Cadastro só por convite válido de um admin.
  const invite = await getValidInvite(data.inviteToken);
  if (!invite) {
    return {
      error:
        "Convite inválido ou expirado. Peça um novo link ao administrador da banda.",
    };
  }
  // O telefone é travado no convite — confere no servidor de qualquer forma.
  if (!samePhone(data.telefone, invite.telefone)) {
    return {
      fieldErrors: { telefone: ["Telefone diferente do convite"] },
      error: "Este convite é para outro telefone.",
    };
  }
  // Se o convite fixou uma posição, ela é obrigatória e imutável.
  if (invite.posicao && data.posicao.toLowerCase() !== invite.posicao.toLowerCase()) {
    return {
      fieldErrors: { posicao: ["Posição definida pelo convite"] },
      error: "Este convite é para outra posição.",
    };
  }

  const existing = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(or(eq(users.username, data.username), eq(users.email, data.email)));
  if (existing.some((u) => u.username === data.username)) {
    return { fieldErrors: { username: ["Usuário já existe"] }, error: "Usuário já existe." };
  }
  if (existing.some((u) => u.email === data.email)) {
    return { fieldErrors: { email: ["Email já cadastrado"] }, error: "Email já cadastrado." };
  }

  const available = await getAvailablePositions();
  if (!available.some((p) => p.toLowerCase() === data.posicao.toLowerCase())) {
    return {
      fieldErrors: { posicao: ["Posição inválida"] },
      error: "Posição inválida.",
    };
  }

  const passwordHash = await hashPassword(data.password);
  const [created] = await db
    .insert(users)
    .values({
      username: data.username,
      passwordHash,
      role: "membro",
      status: "aprovado", // convite já é a aprovação — entra direto
      nome: data.nome,
      sobrenome: data.sobrenome,
      email: data.email,
      telefone: data.telefone,
      chavePix: data.chavePix,
      posicao: data.posicao,
    })
    .returning({ id: users.id });

  // Consome o convite (single-use), amarrando ao usuário criado.
  await db
    .update(inviteTokens)
    .set({ redeemedEm: new Date(), redeemedUserId: created.id })
    .where(eq(inviteTokens.id, invite.id));

  // Cria/vincula o músico correspondente (antes feito na aprovação do admin).
  await linkOrCreateMember(created.id, {
    nome: `${data.nome} ${data.sobrenome}`.trim(),
    posicao: data.posicao,
    telefone: data.telefone,
    chavePix: data.chavePix,
  });

  // Avisa os admins por push que entrou gente nova (não bloqueia se falhar).
  try {
    await sendPushToAdmins({
      title: "Novo membro entrou 🎸",
      body: `${data.nome} ${data.sobrenome} (${data.posicao}) se cadastrou pelo convite.`,
      url: "/cadastros",
      tag: `cadastro-${data.username}`,
    });
  } catch (e) {
    console.error("push (novo membro) falhou:", e);
  }

  return { success: true };
}

/** Liga o usuário recém-criado a um músico existente (mesma posição, sem
 * login) ou cria um novo registro de músico. */
async function linkOrCreateMember(
  userId: string,
  data: { nome: string; posicao: string; telefone: string; chavePix: string }
) {
  const candidates = await db
    .select()
    .from(members)
    .where(and(eq(members.ativo, true), isNull(members.userId)));
  const match = candidates.find(
    (m) => m.funcao.toLowerCase() === data.posicao.toLowerCase()
  );

  if (match) {
    await db
      .update(members)
      .set({
        userId,
        nome: data.nome || match.nome,
        telefone: data.telefone ?? match.telefone,
        chavePix: data.chavePix ?? match.chavePix,
      })
      .where(eq(members.id, match.id));
    return;
  }

  const [already] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1);
  if (!already) {
    await db.insert(members).values({
      nome: data.nome || "A definir",
      funcao: data.posicao,
      telefone: data.telefone,
      chavePix: data.chavePix,
      userId,
      ativo: true,
    });
  }
}
