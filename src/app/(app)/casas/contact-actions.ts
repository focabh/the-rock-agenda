"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { venues, venueContacts } from "@/db/schema";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";
import type { VenueMsgTipo } from "@/lib/venue-messages";
import {
  analyzeVenueWithAI,
  NoApiKeyError,
  type VenueAISuggestion,
} from "@/lib/venue-ai";

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

/** Salva características (tags) e perfil de público da casa. */
export async function setVenueProfileAction(
  venueId: string,
  patch: { caracteristicas?: string[]; perfilPublico?: string | null }
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const set: Record<string, string | null> = {};
  if ("caracteristicas" in patch)
    set.caracteristicas = JSON.stringify(patch.caracteristicas ?? []);
  if ("perfilPublico" in patch)
    set.perfilPublico = patch.perfilPublico?.trim() || null;
  if (Object.keys(set).length)
    await db.update(venues).set(set).where(eq(venues.id, venueId));
  revalidatePath(`/casas/${venueId}`);
  return { ok: true };
}

/** Analisa o perfil da casa com IA (web search). Retorna sugestão (não salva). */
export async function analyzeVenueAction(venueId: string): Promise<{
  ok: boolean;
  suggestion?: VenueAISuggestion;
  error?: string;
  needsKey?: boolean;
}> {
  await requireAdmin();
  const [v] = await db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
  if (!v) return { ok: false, error: "Casa não encontrada." };
  try {
    const suggestion = await analyzeVenueWithAI({
      nome: v.nome,
      cidade: v.cidade,
      instagram: v.instagram,
    });
    return { ok: true, suggestion };
  } catch (e) {
    if (e instanceof NoApiKeyError)
      return { ok: false, needsKey: true, error: e.message };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha na análise.",
    };
  }
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
