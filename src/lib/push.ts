import "server-only";
import webpush from "web-push";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@therockbh.app",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function send(rows: SubRow[], payload: PushPayload) {
  if (!ensureConfigured() || rows.length === 0) {
    return { sent: 0, removed: 0 };
  }
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          body
        );
        sent++;
      } catch (err) {
        // 404/410 => inscrição morta; remove para não tentar de novo.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(r.id);
        else console.error("push send error:", status, err);
      }
    })
  );

  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
  }
  return { sent, removed: dead.length };
}

/** Envia para todos os dispositivos inscritos. */
export async function sendPushToAll(payload: PushPayload) {
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions);
  return send(rows, payload);
}

/** Envia só para os dispositivos de um usuário (ex.: notificação de teste). */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, [userId]));
  return send(rows, payload);
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}
