"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { compileBioData, generateBioAI } from "@/lib/band-bio";
import { NoApiKeyError } from "@/lib/venue-ai";

async function setBio(texto: string | null) {
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) await db.update(appSettings).set({ bioTexto: texto }).where(eq(appSettings.id, row.id));
  else await db.insert(appSettings).values({ bioTexto: texto });
  revalidatePath("/sobre");
  revalidatePath("/show");
}

/** Salva a bio digitada à mão (custo R$ 0). */
export async function saveBioAction(texto: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  await setBio(texto.trim().slice(0, 2000) || null);
  return { ok: true };
}

/** Gera a bio com IA (Haiku, sob demanda) a partir dos dados do banco e salva. */
export async function generateBioAction(): Promise<{
  ok: boolean;
  texto?: string;
  error?: string;
  needsKey?: boolean;
}> {
  await requireAdmin();
  try {
    const [row] = await db.select().from(appSettings).limit(1);
    const bandName = row?.bandName?.trim() || "The Rock";
    const data = await compileBioData();
    const texto = await generateBioAI(bandName, data);
    if (!texto) return { ok: false, error: "A IA não retornou texto." };
    await setBio(texto);
    return { ok: true, texto };
  } catch (e) {
    if (e instanceof NoApiKeyError) return { ok: false, needsKey: true, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Falha." };
  }
}
