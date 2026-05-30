"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { venues, venueContacts } from "@/db/schema";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";
import type { VenueMsgTipo } from "@/lib/venue-messages";

/**
 * Registra um contato feito com a casa pelo app e dispara as automações:
 * sempre atualiza "último contato"; divulgação marca material enviado;
 * agradecimento marca agradecimento enviado.
 */
export async function logVenueContactAction(
  venueId: string,
  tipo: VenueMsgTipo,
  mensagem?: string
): Promise<{ ok: boolean }> {
  const user = await requireCurrentUser();
  const now = new Date();

  await db.insert(venueContacts).values({
    venueId,
    tipo,
    mensagem: mensagem?.slice(0, 2000) || null,
    createdById: user.id,
  });

  const patch: Record<string, Date> = { ultimoContatoEm: now };
  if (tipo === "divulgacao") patch.materialEnviadoEm = now;
  if (tipo === "agradecimento") patch.agradecimentoEnviadoEm = now;
  await db.update(venues).set(patch).where(eq(venues.id, venueId));

  revalidatePath(`/casas/${venueId}`);
  revalidatePath("/casas");
  revalidatePath("/");
  return { ok: true };
}

export async function setVenueRelAction(
  venueId: string,
  patch: { querTocar?: boolean; jaTocou?: boolean; naoContatar?: boolean }
): Promise<{ ok: boolean }> {
  await requireAdmin();
  await db.update(venues).set(patch).where(eq(venues.id, venueId));
  revalidatePath(`/casas/${venueId}`);
  revalidatePath("/casas");
  revalidatePath("/");
  return { ok: true };
}

/** Ajuste manual de histórico antigo (datas) — string "yyyy-mm-dd" ou vazio pra limpar. */
export async function setVenueHistoryAction(
  venueId: string,
  patch: { materialEnviadoEm?: string | null; ultimaApresentacaoManual?: string | null }
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const toDate = (s?: string | null) =>
    s && s.trim() ? new Date(`${s}T12:00:00`) : null;
  const set: Record<string, Date | null> = {};
  if ("materialEnviadoEm" in patch)
    set.materialEnviadoEm = toDate(patch.materialEnviadoEm);
  if ("ultimaApresentacaoManual" in patch)
    set.ultimaApresentacaoManual = toDate(patch.ultimaApresentacaoManual);
  if (Object.keys(set).length) {
    await db.update(venues).set(set).where(eq(venues.id, venueId));
  }
  revalidatePath(`/casas/${venueId}`);
  revalidatePath("/casas");
  revalidatePath("/");
  return { ok: true };
}
