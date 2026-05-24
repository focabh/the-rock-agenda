"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shows, showMemberPayment } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

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

export async function setMemberPaymentAction(
  showId: string,
  memberId: string,
  valorCentavos: number
) {
  await requireAdmin();
  const v = Math.max(0, Math.round(valorCentavos));
  const existing = await db.query.showMemberPayment.findFirst({
    where: and(
      eq(showMemberPayment.showId, showId),
      eq(showMemberPayment.memberId, memberId)
    ),
  });
  if (existing) {
    await db
      .update(showMemberPayment)
      .set({ valorCentavos: v })
      .where(eq(showMemberPayment.id, existing.id));
  } else {
    await db.insert(showMemberPayment).values({
      showId,
      memberId,
      valorCentavos: v,
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
