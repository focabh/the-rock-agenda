"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reembolsos, members, showMemberPaid } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";
import { parseBRDateTime } from "@/lib/formatters";
import { sendPushToUser, sendPushToAdmins } from "@/lib/push";

const MAX_COMPROVANTE = 4_000_000;

const schema = z.object({
  memberId: z.string().min(1, "Selecione o músico"),
  gastoId: z.string().optional(),
  descricao: z.string().trim().min(2, "Descreva o reembolso").max(300),
  valorReais: z.coerce.number().positive("Informe o valor pago"),
  paidEm: z
    .string()
    .min(1, "Informe a data/hora do pagamento")
    .transform((s) => parseBRDateTime(s)),
  comprovante: z.string().min(1, "Anexe o comprovante PIX"),
});

export async function createReembolsoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await requireCurrentUser();
  if (me.role !== "admin") return { error: "Apenas admins efetuam pagamentos." };

  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const d = parsed.data;

  if (!d.comprovante.startsWith("data:")) {
    return { error: "Anexe o comprovante PIX." };
  }
  if (d.comprovante.length > MAX_COMPROVANTE) {
    return { error: "Comprovante muito grande. Use uma imagem menor." };
  }

  await db.insert(reembolsos).values({
    memberId: d.memberId,
    gastoId: d.gastoId || null,
    descricao: d.descricao,
    valorCentavos: Math.round(d.valorReais * 100),
    comprovante: d.comprovante,
    paidEm: d.paidEm,
    createdBy: me.id,
  });

  // Notifica o músico (se tiver login com push ativo).
  try {
    const [m] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(eq(members.id, d.memberId))
      .limit(1);
    if (m?.userId) {
      await sendPushToUser(m.userId, {
        title: "Reembolso registrado 💸",
        body: `O admin pagou seu reembolso (${d.descricao}). Confirme o recebimento.`,
        url: "/pagamentos",
        tag: `reembolso-${d.memberId}`,
      });
    }
  } catch (e) {
    console.error("push (reembolso) falhou:", e);
  }

  revalidatePath("/pagamentos");
  redirect("/pagamentos");
}

export async function confirmReembolsoAction(reembolsoId: string) {
  const user = await requireCurrentUser();
  const [row] = await db
    .select({ memberId: reembolsos.memberId })
    .from(reembolsos)
    .where(eq(reembolsos.id, reembolsoId))
    .limit(1);
  if (!row) return { error: "Reembolso não encontrado." };
  if (user.role !== "admin" && user.member?.id !== row.memberId) {
    return { error: "Você só pode confirmar o seu próprio reembolso." };
  }
  await db
    .update(reembolsos)
    .set({ status: "confirmado", confirmadoEm: new Date() })
    .where(eq(reembolsos.id, reembolsoId));
  try {
    const nome = user.member?.nome ?? "Um músico";
    await sendPushToAdmins({
      title: "Reembolso confirmado ✅",
      body: `${nome} confirmou o recebimento do reembolso.`,
      url: "/pagamentos",
      tag: `reembolso-${reembolsoId}`,
    });
  } catch (e) {
    console.error("push (confirm reembolso) falhou:", e);
  }
  revalidatePath("/pagamentos");
  return { ok: true };
}

export async function reportReembolsoNotReceivedAction(reembolsoId: string) {
  const user = await requireCurrentUser();
  const [row] = await db
    .select({ memberId: reembolsos.memberId })
    .from(reembolsos)
    .where(eq(reembolsos.id, reembolsoId))
    .limit(1);
  if (!row) return { error: "Reembolso não encontrado." };
  if (user.role !== "admin" && user.member?.id !== row.memberId) {
    return { error: "Sem permissão." };
  }
  await db.delete(reembolsos).where(eq(reembolsos.id, reembolsoId));
  try {
    const nome = user.member?.nome ?? "Um músico";
    await sendPushToAdmins({
      title: "Reembolso contestado ⚠️",
      body: `${nome} informou que NÃO recebeu o reembolso.`,
      url: "/pagamentos",
      tag: `reembolso-${reembolsoId}`,
    });
  } catch (e) {
    console.error("push (contestar reembolso) falhou:", e);
  }
  revalidatePath("/pagamentos");
  return { ok: true };
}

export async function deleteReembolsoAction(reembolsoId: string) {
  await requireAdmin();
  await db.delete(reembolsos).where(eq(reembolsos.id, reembolsoId));
  revalidatePath("/pagamentos");
  return { ok: true };
}

export async function getReembolsoComprovanteAction(
  reembolsoId: string
): Promise<{ url: string | null; error?: string }> {
  const user = await requireCurrentUser();
  const [row] = await db
    .select({
      comprovante: reembolsos.comprovante,
      memberId: reembolsos.memberId,
    })
    .from(reembolsos)
    .where(eq(reembolsos.id, reembolsoId))
    .limit(1);
  if (!row) return { url: null, error: "Não encontrado." };
  if (user.role !== "admin" && user.member?.id !== row.memberId) {
    return { url: null, error: "Sem permissão." };
  }
  return { url: row.comprovante };
}

// Pega o comprovante de um cachê (show_member_paid).
// O confirm/reportNotReceived para cachê vivem em shows/[id]/actions-payment.ts
// e são importados diretamente pelo componente de lista.
export async function getCacheComprovanteAction(
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
      and(eq(showMemberPaid.showId, showId), eq(showMemberPaid.memberId, memberId))
    )
    .limit(1);
  return { url: row?.comprovante ?? null };
}
