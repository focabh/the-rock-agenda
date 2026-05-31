"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { imagensDivulgacao } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/** Adiciona uma imagem à galeria de divulgação (data URL enviado ou link http). */
export async function addImagemDivulgacaoAction(
  url: string,
  legenda?: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const u = url.trim();
  const valido = /^data:image\/(png|jpe?g|webp);base64,/.test(u) || /^https?:\/\//.test(u);
  if (!valido) return { ok: false, error: "Envie uma imagem ou cole um link http(s)." };
  if (u.length > 6_000_000) return { ok: false, error: "Imagem muito grande." };
  await db.insert(imagensDivulgacao).values({ url: u, legenda: legenda?.slice(0, 120) || null });
  revalidatePath("/shows");
  return { ok: true };
}

export async function deleteImagemDivulgacaoAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  await db.delete(imagensDivulgacao).where(eq(imagensDivulgacao.id, id));
  revalidatePath("/shows");
  return { ok: true };
}

export async function listImagensDivulgacao() {
  return db.select().from(imagensDivulgacao).orderBy(desc(imagensDivulgacao.createdAt));
}
