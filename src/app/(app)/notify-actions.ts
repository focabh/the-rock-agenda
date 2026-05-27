"use server";

import { requireAdmin } from "@/lib/auth";
import { sendPushToAll } from "@/lib/push";

/** Admin dispara um push para toda a banda (todos os dispositivos inscritos). */
export async function notifyBandAction(input: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  await requireAdmin();
  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title || !body) return { error: "Faltou o título ou a mensagem." };

  const res = await sendPushToAll({
    title,
    body,
    url: input.url || "/",
    tag: input.tag,
  });
  return { ok: true, sent: res.sent };
}
