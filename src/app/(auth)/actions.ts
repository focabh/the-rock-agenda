"use server";

import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getAvailablePositions,
  getSession,
  hashPassword,
  registrationsAllowed,
  verifyPassword,
} from "@/lib/auth";
import { parseForm } from "@/lib/form";
import { sendRegistrationNotification } from "@/lib/email";
import { POSICOES, cpfValido, pixValido, telefoneValido } from "@/lib/validators";

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Preencha usuário e senha." };
  }

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
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
  email: z.string().trim().email("Email inválido").max(160),
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(40)
    .regex(/^[a-z0-9._-]+$/, "Use só letras minúsculas, números, . _ -"),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
  telefone: z
    .string()
    .trim()
    .refine(telefoneValido, "Telefone inválido (DDD + número)"),
  cpf: z.string().trim().refine(cpfValido, "CPF inválido"),
  chavePix: z
    .string()
    .trim()
    .max(200)
    .refine(pixValido, "Chave PIX inválida (email, CPF, telefone ou chave aleatória)"),
  posicao: z.enum(POSICOES),
});

export type RegisterState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
} | null;

export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  if (!(await registrationsAllowed())) {
    return { error: "Os cadastros estão fechados no momento." };
  }

  const parsed = parseForm(registerSchema, formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

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
      fieldErrors: { posicao: ["Essa posição já foi escolhida"] },
      error: "Posição indisponível.",
    };
  }

  const passwordHash = await hashPassword(data.password);
  await db.insert(users).values({
    username: data.username,
    passwordHash,
    role: "membro",
    status: "pendente",
    nome: data.nome,
    sobrenome: data.sobrenome,
    email: data.email,
    telefone: data.telefone,
    cpf: data.cpf,
    chavePix: data.chavePix,
    posicao: data.posicao,
  });

  await sendRegistrationNotification({
    nome: `${data.nome} ${data.sobrenome}`,
    username: data.username,
    email: data.email,
    telefone: data.telefone,
    chavePix: data.chavePix,
    posicao: data.posicao,
  });

  return { success: true };
}
