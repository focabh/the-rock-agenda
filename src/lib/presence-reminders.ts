// Cobrança automática de confirmação de presença (oportunista: roda quando
// alguém abre o app). Reenvia push pros membros que ainda não confirmaram, no
// ritmo do nível de urgência do evento, até confirmar / o evento passar / teto.

import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  shows,
  rehearsals,
  members,
  showMemberPresence,
  rehearsalMemberPresence,
} from "@/db/schema";
import { sendPushToUser } from "@/lib/push";
import { formatDataBR } from "@/lib/formatters";

const H = 3600_000;
const CADENCIA: Record<string, number> = {
  tranquila: 24 * H,
  importante: 12 * H,
  urgente: 4 * H,
};
const TETO = 5; // máximo de reforços por evento

type Pend = { memberId: string; userId: string };

/** Verifica todos os eventos futuros com cobrança ligada e reenvia o que venceu.
 *  Idempotente: respeita a cadência (não reenvia antes da hora). */
export async function runDuePresenceReminders(): Promise<{ enviados: number }> {
  const agora = Date.now();

  // Membros que tocam e têm login (só esses recebem push).
  const elenco = await db
    .select({ id: members.id, userId: members.userId })
    .from(members)
    .where(and(eq(members.ativo, true), eq(members.isManager, false)));
  const comLogin = elenco.filter((m) => m.userId) as { id: string; userId: string }[];
  if (comLogin.length === 0) return { enviados: 0 };

  let enviados = 0;

  const due = (nivel: string, enviadoEm: Date | null, count: number) => {
    const cad = CADENCIA[nivel];
    if (!cad || count >= TETO) return false;
    if (!enviadoEm) return true;
    return agora - enviadoEm.getTime() >= cad;
  };

  // ---- SHOWS ----
  const futShows = await db
    .select()
    .from(shows)
    .where(and(gt(shows.data, new Date(agora)), ne(shows.lembreteNivel, "off")));
  for (const s of futShows) {
    if (!due(s.lembreteNivel, s.lembreteEnviadoEm, s.lembretesEnviados)) continue;
    const respondidos = await db
      .select({ memberId: showMemberPresence.memberId, status: showMemberPresence.status })
      .from(showMemberPresence)
      .where(eq(showMemberPresence.showId, s.id));
    const pend = pendentes(comLogin, respondidos);
    if (pend.length === 0) continue;
    await avisar(pend, {
      title: "Confirme sua presença 🥁",
      body: `Show ${formatDataBR(s.data, true)} — toque pra confirmar.`,
      url: `/shows/${s.id}?p=1`,
      tag: `presenca-show-${s.id}`,
    });
    enviados += pend.length;
    await db
      .update(shows)
      .set({ lembreteEnviadoEm: new Date(agora), lembretesEnviados: s.lembretesEnviados + 1 })
      .where(eq(shows.id, s.id));
  }

  // ---- ENSAIOS ----
  const futEns = await db
    .select()
    .from(rehearsals)
    .where(and(gt(rehearsals.data, new Date(agora)), ne(rehearsals.lembreteNivel, "off")));
  for (const r of futEns) {
    if (!due(r.lembreteNivel, r.lembreteEnviadoEm, r.lembretesEnviados)) continue;
    const respondidos = await db
      .select({ memberId: rehearsalMemberPresence.memberId, status: rehearsalMemberPresence.status })
      .from(rehearsalMemberPresence)
      .where(eq(rehearsalMemberPresence.rehearsalId, r.id));
    const pend = pendentes(comLogin, respondidos);
    if (pend.length === 0) continue;
    await avisar(pend, {
      title: "Confirme presença no ensaio 🎸",
      body: `Ensaio ${formatDataBR(r.data, true)} — toque pra confirmar.`,
      url: `/ensaios/${r.id}?p=1`,
      tag: `presenca-ensaio-${r.id}`,
    });
    enviados += pend.length;
    await db
      .update(rehearsals)
      .set({ lembreteEnviadoEm: new Date(agora), lembretesEnviados: r.lembretesEnviados + 1 })
      .where(eq(rehearsals.id, r.id));
  }

  return { enviados };
}

/** Pendentes = elenco menos quem já confirmou ou recusou. */
function pendentes(
  elenco: { id: string; userId: string }[],
  respondidos: { memberId: string; status: string }[]
): Pend[] {
  const fechados = new Set(
    respondidos.filter((r) => r.status === "confirmado" || r.status === "recusado").map((r) => r.memberId)
  );
  return elenco.filter((m) => !fechados.has(m.id)).map((m) => ({ memberId: m.id, userId: m.userId }));
}

async function avisar(pend: Pend[], payload: { title: string; body: string; url: string; tag: string }) {
  const userIds = [...new Set(pend.map((p) => p.userId))];
  await Promise.all(userIds.map((uid) => sendPushToUser(uid, payload).catch(() => {})));
}
