"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession, verifyPassword } from "@/lib/auth";

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
