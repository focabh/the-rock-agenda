"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export type AnnouncementResult = { ok: boolean; error?: string };

export async function createAnnouncementAction(
  titulo: string,
  corpo: string
): Promise<AnnouncementResult> {
  const user = await requireAdmin();
  const t = titulo.trim();
  if (!t) return { ok: false, error: "Escreva um título pro anúncio." };
  if (t.length > 200) return { ok: false, error: "Título muito longo." };
  await db.insert(announcements).values({
    titulo: t,
    corpo: corpo.trim() || null,
    createdById: user.id,
  });
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAnnouncementAction(
  id: string
): Promise<AnnouncementResult> {
  await requireAdmin();
  await db.delete(announcements).where(eq(announcements.id, id));
  revalidatePath("/");
  return { ok: true };
}
