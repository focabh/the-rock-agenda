import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  members,
  memberUnavailability,
  showMemberPresence,
  rehearsalMemberPresence,
} from "@/db/schema";
import { membersUnavailableOn } from "@/lib/conflicts";
import { sendPushToUser, type PushPayload } from "@/lib/push";

type EventKind = "show" | "rehearsal";

/**
 * Núcleo PURO da seleção de destinatários (testável sem DB): dos membros ativos,
 * fica com os que têm conta (userId) e tira quem recusou presença, quem está
 * indisponível na data e o autor da ação. Devolve userIds únicos.
 */
export function eligibleUserIds(input: {
  activeMembers: { id: string; userId: string | null }[];
  declinedMemberIds: Iterable<string>;
  unavailableMemberIds: Iterable<string>;
  exceptUserId?: string | null;
}): string[] {
  const declined = new Set(input.declinedMemberIds);
  const unavailable = new Set(input.unavailableMemberIds);
  const userIds = input.activeMembers
    .filter(
      (m) =>
        m.userId &&
        !declined.has(m.id) &&
        !unavailable.has(m.id) &&
        m.userId !== input.exceptUserId
    )
    .map((m) => m.userId as string);
  return Array.from(new Set(userIds));
}

/**
 * Notifica a banda sobre mudança em evento (show/ensaio), push POR MEMBRO,
 * EXCLUINDO quem não deve ser incomodado naquele dia:
 *  - quem RECUSOU presença no evento (presence status "recusado");
 *  - quem está INDISPONÍVEL na data (memberUnavailability cobrindo o dia);
 *  - opcionalmente o AUTOR da ação (exceptUserId) — não se auto-notifica.
 *
 * Só atinge membros ATIVOS com conta de usuário (sem userId não há push_subscription).
 * Best-effort: nunca lança — loga e segue (não trava a criação/edição do evento).
 */
export async function notifyEventChange(opts: {
  kind: EventKind;
  eventId: string;
  eventDate: Date | number;
  payload: PushPayload;
  exceptUserId?: string | null;
}): Promise<void> {
  const { kind, eventId, eventDate, payload, exceptUserId } = opts;
  try {
    // Membros ativos; só os que têm conta (userId) podem receber push.
    const activeMembers = await db
      .select()
      .from(members)
      .where(eq(members.ativo, true));
    if (!activeMembers.some((m) => m.userId)) return;

    // Quem recusou presença NESTE evento.
    const declined = new Set<string>();
    if (kind === "show") {
      const rows = await db
        .select({ memberId: showMemberPresence.memberId })
        .from(showMemberPresence)
        .where(
          and(
            eq(showMemberPresence.showId, eventId),
            eq(showMemberPresence.status, "recusado")
          )
        );
      rows.forEach((r) => declined.add(r.memberId));
    } else {
      const rows = await db
        .select({ memberId: rehearsalMemberPresence.memberId })
        .from(rehearsalMemberPresence)
        .where(
          and(
            eq(rehearsalMemberPresence.rehearsalId, eventId),
            eq(rehearsalMemberPresence.status, "recusado")
          )
        );
      rows.forEach((r) => declined.add(r.memberId));
    }

    // Quem está indisponível na data do evento (mesma regra de fuso da agenda).
    const blocks = await db.select().from(memberUnavailability);
    const unavailable = membersUnavailableOn(eventDate, blocks, activeMembers).map(
      (m) => m.id
    );

    const userIds = eligibleUserIds({
      activeMembers,
      declinedMemberIds: declined,
      unavailableMemberIds: unavailable,
      exceptUserId,
    });
    if (userIds.length === 0) return;

    await Promise.all(userIds.map((uid) => sendPushToUser(uid, payload)));
  } catch (e) {
    console.error("notifyEventChange falhou:", e);
  }
}
