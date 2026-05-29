import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inviteTokens } from "@/db/schema";
import type { InviteToken } from "@/db/schema";
import { onlyDigits } from "@/lib/validators";

/** Validade padrão de um convite: 7 dias. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Gera um token de convite opaco e URL-safe (32 chars hex). */
export function generateInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export type InviteStatus = "valido" | "usado" | "revogado" | "expirado";

export function inviteStatus(invite: InviteToken, now = new Date()): InviteStatus {
  if (invite.redeemedEm) return "usado";
  if (invite.revokedEm) return "revogado";
  if (invite.expiresEm.getTime() <= now.getTime()) return "expirado";
  return "valido";
}

/**
 * Busca um convite pelo token e devolve só se ainda for utilizável
 * (não usado, não revogado, não expirado). Caso contrário, null.
 */
export async function getValidInvite(
  token: string | undefined | null
): Promise<InviteToken | null> {
  const t = (token ?? "").trim();
  if (!t) return null;
  try {
    const [invite] = await db
      .select()
      .from(inviteTokens)
      .where(eq(inviteTokens.token, t))
      .limit(1);
    if (!invite) return null;
    return inviteStatus(invite) === "valido" ? invite : null;
  } catch {
    return null;
  }
}

/** Compara dois telefones ignorando máscara (só dígitos). */
export function samePhone(a: string, b: string): boolean {
  return onlyDigits(a) === onlyDigits(b);
}
