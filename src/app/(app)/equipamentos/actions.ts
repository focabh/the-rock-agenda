"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { equipamentos } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

const CATEGORIAS = ["individual", "infraestrutura_coletiva"] as const;
const TIPOS = ["mesa_som", "pa", "retorno_palco", "in_ear", "microfone", "periferico", "outro"] as const;

export async function createEquipamentoAction(data: {
  nome: string;
  categoria: string;
  tipo: string;
  proprietarioId?: string | null;
  especificacoes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const nome = data.nome.trim().slice(0, 120);
  if (!nome) return { ok: false, error: "Nome obrigatório." };
  const categoria = (CATEGORIAS as readonly string[]).includes(data.categoria)
    ? (data.categoria as (typeof CATEGORIAS)[number])
    : "infraestrutura_coletiva";
  const tipo = (TIPOS as readonly string[]).includes(data.tipo)
    ? (data.tipo as (typeof TIPOS)[number])
    : "outro";
  await db.insert(equipamentos).values({
    nome,
    categoria,
    tipo,
    proprietarioId: categoria === "individual" ? data.proprietarioId || null : null,
    especificacoes: data.especificacoes?.trim().slice(0, 300) || null,
  });
  revalidatePath("/equipamentos");
  revalidatePath("/rider");
  return { ok: true };
}

export async function deleteEquipamentoAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  await db.delete(equipamentos).where(eq(equipamentos.id, id));
  revalidatePath("/equipamentos");
  revalidatePath("/rider");
  return { ok: true };
}
