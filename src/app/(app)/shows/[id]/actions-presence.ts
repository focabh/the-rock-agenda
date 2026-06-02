"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { showMemberPresence, members } from "@/db/schema";
import { requireCurrentUser } from "@/lib/auth";

const STATUSES = ["pendente", "confirmado", "recusado"] as const;
type Status = (typeof STATUSES)[number];

export async function setPresenceAction(
  showId: string,
  memberId: string,
  status: Status,
  viaPush?: boolean
) {
  const user = await requireCurrentUser();
  // admin pode mudar qualquer um; membro só o próprio
  const isAdmin = user.role === "admin";
  const isSelf = user.member?.id === memberId;
  if (!isAdmin && !isSelf) {
    return { error: "Você só pode confirmar a própria presença." };
  }
  const marcouPush = !!viaPush && status === "confirmado";
  const existing = await db.query.showMemberPresence.findFirst({
    where: and(
      eq(showMemberPresence.showId, showId),
      eq(showMemberPresence.memberId, memberId)
    ),
  });
  if (existing) {
    await db
      .update(showMemberPresence)
      .set({ status, viaPush: marcouPush || existing.viaPush })
      .where(eq(showMemberPresence.id, existing.id));
  } else {
    await db.insert(showMemberPresence).values({ showId, memberId, status, viaPush: marcouPush });
  }
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/");
  return { ok: true };
}
