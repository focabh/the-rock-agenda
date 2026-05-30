import { db } from "@/db";
import { ensureDbInitialized } from "@/db/init";
import type { Member, User } from "@/db/schema";
import { appSettings, members, users } from "@/db/schema";
import { POSICOES } from "@/lib/validators";
import bcrypt from "bcryptjs";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AppSession = {
  authed?: boolean;
  username?: string;
};

const THIRTY_DAYS = 60 * 60 * 24 * 30;

const sessionOptions: SessionOptions = {
  cookieName: "therock_session",
  password:
    process.env.SESSION_SECRET ??
    "dev-secret-replace-me-with-at-least-32-chars-please",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: THIRTY_DAYS,
  },
  ttl: THIRTY_DAYS,
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<AppSession>(cookieStore, sessionOptions);
}

export type CurrentUser = User & { member: Member | null };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    await ensureDbInitialized();
  } catch (e) {
    console.error("DB init failed:", e);
  }
  const session = await getSession();
  if (!session.authed || !session.username) return null;
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, session.username))
      .limit(1);
    if (!user) return null;
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.userId, user.id))
      .limit(1);
    return { ...user, member: member ?? null };
  } catch (e) {
    console.error("Error fetching current user:", e);
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session.authed) redirect("/login");
  return session;
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireCurrentUser();
  if (user.role !== "admin") {
    redirect("/?erro=permissao");
  }
  return user;
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin";
}

/**
 * Nome a ser exibido no app inteiro para um usuário: apelido > nome (+ sobrenome) > username.
 * Quem se cadastra define nome/sobrenome; o apelido (em Conta) sobrescreve.
 */
export function userDisplayName(u: {
  apelido?: string | null;
  nome?: string | null;
  sobrenome?: string | null;
  username: string;
}): string {
  const apelido = u.apelido?.trim();
  if (apelido) return apelido;
  const full = [u.nome, u.sobrenome].filter(Boolean).join(" ").trim();
  return full || u.username;
}

export async function registrationsAllowed(): Promise<boolean> {
  try {
    const [s] = await db.select().from(appSettings).limit(1);
    return s?.allowRegistrations ?? true;
  } catch {
    return false;
  }
}

/** Posições da banda ainda livres (não escolhidas por usuário pendente/aprovado). */
export async function getAvailablePositions(): Promise<string[]> {
  try {
    const taken = await db
      .select({ posicao: users.posicao })
      .from(users)
      .where(
        and(
          isNotNull(users.posicao),
          inArray(users.status, ["pendente", "aprovado"]),
        ),
      );
    const takenSet = new Set(taken.map((t) => (t.posicao ?? "").toLowerCase()));
    return POSICOES.filter((p) => !takenSet.has(p.toLowerCase()));
  } catch {
    return [...POSICOES];
  }
}

export const DEFAULT_LOGO = "/the-rock-logo.png";

export async function getLogoUrl(): Promise<string> {
  try {
    const [s] = await db
      .select({ logoUrl: appSettings.logoUrl })
      .from(appSettings)
      .limit(1);
    return s?.logoUrl || DEFAULT_LOGO;
  } catch {
    return DEFAULT_LOGO;
  }
}

export async function verifyPassword(input: string, hash: string) {
  return bcrypt.compare(input, hash);
}

export async function hashPassword(input: string) {
  return bcrypt.hash(input, 10);
}
