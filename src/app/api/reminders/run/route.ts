import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runDuePresenceReminders } from "@/lib/presence-reminders";

/** Disparo oportunista das cobranças de presença (chamado quando alguém abre o
 *  app). Idempotente — respeita a cadência de cada evento. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const r = await runDuePresenceReminders();
    return NextResponse.json({ ok: true, ...r });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
