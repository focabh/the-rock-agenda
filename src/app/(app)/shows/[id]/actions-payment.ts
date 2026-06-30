"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shows, showMemberPayment, showMemberPaid, members } from "@/db/schema";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";
import { sendPushToUser, sendPushToAdmins } from "@/lib/push";

// ~4MB de data URL (imagem comprimida no cliente ou PDF pequeno)
const MAX_COMPROVANTE = 4_000_000;

// Admin marca o repasse como pago e ANEXA o comprovante (obrigatório).
// Fica "aguardando" a confirmação do músico, que recebe um push.
export async function markMemberPaidAction(
  showId: string,
  memberId: string,
  comprovante: string
) {
  await requireAdmin();
  if (!comprovante || !comprovante.startsWith("data:")) {
    return { error: "Anexe o comprovante de pagamento." };
  }
  if (comprovante.length > MAX_COMPROVANTE) {
    return { error: "Comprovante muito grande. Use uma imagem menor." };
  }

  const existing = await db
    .select({ id: showMemberPaid.id })
    .from(showMemberPaid)
    .where(
      and(
        eq(showMemberPaid.showId, showId),
        eq(showMemberPaid.memberId, memberId)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(showMemberPaid)
      .set({
        status: "aguardando",
        comprovante,
        pagoEm: new Date(),
        confirmadoEm: null,
      })
      .where(eq(showMemberPaid.id, existing[0].id));
  } else {
    await db.insert(showMemberPaid).values({
      showId,
      memberId,
      status: "aguardando",
      comprovante,
    });
  }

  // Avisa o músico (se tiver login vinculado e notificações ativas).
  try {
    const [m] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    if (m?.userId) {
      await sendPushToUser(m.userId, {
        title: "Pagamento registrado 💸",
        body: "O admin marcou seu cachê como pago. Confira o comprovante e confirme o recebimento.",
        url: `/shows/${showId}`,
        tag: `pay-${showId}-${memberId}`,
      });
    }
  } catch (e) {
    console.error("push (pagamento) falhou:", e);
  }

  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

// Músico confirma que recebeu (ou admin confirma no lugar dele).
export async function confirmMemberPaymentAction(
  showId: string,
  memberId: string
) {
  const user = await requireCurrentUser();
  if (user.role !== "admin" && user.member?.id !== memberId) {
    return { error: "Você só pode confirmar o seu próprio recebimento." };
  }
  await db
    .update(showMemberPaid)
    .set({ status: "confirmado", confirmadoEm: new Date() })
    .where(
      and(
        eq(showMemberPaid.showId, showId),
        eq(showMemberPaid.memberId, memberId)
      )
    );
  try {
    const nome = user.member?.nome ?? "Um músico";
    await sendPushToAdmins({
      title: "Recebimento confirmado ✅",
      body: `${nome} confirmou o recebimento do cachê.`,
      url: `/shows/${showId}`,
      tag: `pay-${showId}-${memberId}`,
    });
  } catch (e) {
    console.error("push (confirmação) falhou:", e);
  }
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

// Músico informa que NÃO recebeu → volta a pendente e avisa os admins.
export async function reportNotReceivedAction(
  showId: string,
  memberId: string
) {
  const user = await requireCurrentUser();
  if (user.role !== "admin" && user.member?.id !== memberId) {
    return { error: "Sem permissão." };
  }
  await db
    .delete(showMemberPaid)
    .where(
      and(
        eq(showMemberPaid.showId, showId),
        eq(showMemberPaid.memberId, memberId)
      )
    );
  try {
    const nome = user.member?.nome ?? "Um músico";
    await sendPushToAdmins({
      title: "Pagamento contestado ⚠️",
      body: `${nome} informou que NÃO recebeu o cachê.`,
      url: `/shows/${showId}`,
      tag: `pay-${showId}-${memberId}`,
    });
  } catch (e) {
    console.error("push (contestação) falhou:", e);
  }
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

// Admin desfaz a marcação de pago (volta a pendente).
export async function unmarkMemberPaidAction(showId: string, memberId: string) {
  await requireAdmin();
  await db
    .delete(showMemberPaid)
    .where(
      and(
        eq(showMemberPaid.showId, showId),
        eq(showMemberPaid.memberId, memberId)
      )
    );
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

// ---------------- RECEBIMENTO DO CONTRATANTE (contratante → banda) ----------------

/** Marca o cachê do show como RECEBIDO. Comprovante OPCIONAL (às vezes é
 *  dinheiro/transferência sem recibo). Admin. */
export async function marcarShowRecebidoAction(
  showId: string,
  comprovante: string | null
) {
  await requireAdmin();
  if (comprovante) {
    if (!comprovante.startsWith("data:")) return { error: "Comprovante inválido." };
    if (comprovante.length > MAX_COMPROVANTE)
      return { error: "Comprovante muito grande. Use um arquivo menor." };
  }
  await db
    .update(shows)
    .set({
      pagamentoStatus: "pago",
      pagamentoComprovante: comprovante ?? null,
      pagamentoEm: new Date(),
    })
    .where(eq(shows.id, showId));
  revalidatePath("/pagamentos");
  revalidatePath("/financeiro");
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

/** Desfaz o recebimento (volta pra pendente). Admin. */
export async function desmarcarShowRecebidoAction(showId: string) {
  await requireAdmin();
  await db
    .update(shows)
    .set({ pagamentoStatus: "pendente", pagamentoComprovante: null, pagamentoEm: null })
    .where(eq(shows.id, showId));
  revalidatePath("/pagamentos");
  revalidatePath("/financeiro");
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

/** Comprovante do recebimento do contratante (admin). */
export async function getShowRecebidoComprovanteAction(
  showId: string
): Promise<{ url: string | null }> {
  await requireAdmin();
  const [s] = await db
    .select({ c: shows.pagamentoComprovante })
    .from(shows)
    .where(eq(shows.id, showId))
    .limit(1);
  return { url: s?.c ?? null };
}

// Carrega o comprovante sob demanda (não vai junto na página). Só admin ou o próprio músico.
export async function getComprovanteAction(
  showId: string,
  memberId: string
): Promise<{ url: string | null; error?: string }> {
  const user = await requireCurrentUser();
  if (user.role !== "admin" && user.member?.id !== memberId) {
    return { url: null, error: "Sem permissão." };
  }
  const [row] = await db
    .select({ comprovante: showMemberPaid.comprovante })
    .from(showMemberPaid)
    .where(
      and(
        eq(showMemberPaid.showId, showId),
        eq(showMemberPaid.memberId, memberId)
      )
    )
    .limit(1);
  return { url: row?.comprovante ?? null };
}

export async function updateShowFinanceAction(
  showId: string,
  patch: {
    cacheCentavos?: number;
    applyCommission?: boolean;
    commissionPct?: number;
  }
) {
  await requireAdmin();
  const update: Record<string, unknown> = {};
  if (patch.cacheCentavos !== undefined)
    update.cacheCentavos = Math.max(0, Math.round(patch.cacheCentavos));
  if (patch.applyCommission !== undefined)
    update.applyCommission = patch.applyCommission;
  if (patch.commissionPct !== undefined)
    update.commissionPct = Math.max(0, Math.min(100, patch.commissionPct));
  if (Object.keys(update).length === 0) return;
  await db.update(shows).set(update).where(eq(shows.id, showId));
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/shows");
  revalidatePath("/");
}

// Define o override de um músico: valor FIXO (centavos) ou PERCENTUAL do cachê.
// Passe `pct` (0..100) pra percentual; senão usa `valorCentavos` (fixo).
export async function setMemberPaymentAction(
  showId: string,
  memberId: string,
  valorCentavos: number,
  pct?: number | null
) {
  await requireAdmin();
  const isPct = pct != null && Number.isFinite(pct);
  const pctClamped = isPct ? Math.max(0, Math.min(100, pct!)) : null;
  const v = isPct ? 0 : Math.max(0, Math.round(valorCentavos));
  const existing = await db.query.showMemberPayment.findFirst({
    where: and(
      eq(showMemberPayment.showId, showId),
      eq(showMemberPayment.memberId, memberId)
    ),
  });
  if (existing) {
    await db
      .update(showMemberPayment)
      .set({ valorCentavos: v, pct: pctClamped })
      .where(eq(showMemberPayment.id, existing.id));
  } else {
    await db.insert(showMemberPayment).values({
      showId,
      memberId,
      valorCentavos: v,
      pct: pctClamped,
    });
  }
  revalidatePath(`/shows/${showId}`);
}

export async function resetMemberPaymentAction(
  showId: string,
  memberId: string
) {
  await requireAdmin();
  await db
    .delete(showMemberPayment)
    .where(
      and(
        eq(showMemberPayment.showId, showId),
        eq(showMemberPayment.memberId, memberId)
      )
    );
  revalidatePath(`/shows/${showId}`);
}

export async function resetAllPaymentsAction(showId: string) {
  await requireAdmin();
  await db.delete(showMemberPayment).where(eq(showMemberPayment.showId, showId));
  revalidatePath(`/shows/${showId}`);
}
