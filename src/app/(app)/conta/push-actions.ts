"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

type WebPushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function subscribePushAction(sub: WebPushSub, userAgent?: string) {
  const user = await getCurrentUser();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { error: "Inscrição inválida." };
  }

  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, sub.endpoint))
    .limit(1);

  if (existing[0]) {
    await db
      .update(pushSubscriptions)
      .set({
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userId: user?.id ?? null,
        userAgent: userAgent ?? null,
      })
      .where(eq(pushSubscriptions.id, existing[0].id));
  } else {
    await db.insert(pushSubscriptions).values({
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userId: user?.id ?? null,
      userAgent: userAgent ?? null,
    });
  }
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string) {
  if (!endpoint) return { ok: true };
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  return { ok: true };
}

export async function sendTestPushAction() {
  const user = await requireCurrentUser();
  const res = await sendPushToUser(user.id, {
    title: "The Rock 🤘",
    body: "Notificações ativadas! É assim que você vai receber os avisos da banda.",
    url: "/",
    tag: "teste",
  });
  if (res.sent === 0) {
    return { error: "Nenhum dispositivo recebeu. Reative as notificações." };
  }
  return { ok: true, sent: res.sent };
}
