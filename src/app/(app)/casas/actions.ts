"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin } from "@/lib/auth";
import { maskPhone, telefoneValido } from "@/lib/validators";

const casaSchema = z.object({
  nome: z.string().min(1, "Obrigatório").max(120),
  cidade: z.string().max(80).optional(),
  bairro: z.string().max(80).optional(),
  endereco: z.string().max(300).optional(),
  estado: z.string().max(40).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  contatoPrincipal: z.string().max(80).optional(),
  telefone: z
    .string()
    .max(40)
    .optional()
    .refine(
      (v) => !v || !v.trim() || telefoneValido(v),
      "Telefone inválido — use DDD + número, ex: (31) 99999-9999"
    ),
  instagram: z.string().max(200).optional(),
  infraestrutura: z.string().max(2000).optional(),
  observacoes: z.string().max(2000).optional(),
});

/** Normaliza o telefone pra máscara padrão (ou null se vazio). */
function normalizeTelefone(tel?: string): string | null {
  const t = (tel ?? "").trim();
  return t ? maskPhone(t) : null;
}

export async function createCasaAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(casaSchema, formData);
  if (!parsed.ok) return parsed.state;

  await db
    .insert(venues)
    .values({ ...parsed.data, telefone: normalizeTelefone(parsed.data.telefone) });
  revalidatePath("/casas");
  redirect("/casas");
}

export async function updateCasaAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(casaSchema, formData);
  if (!parsed.ok) return parsed.state;

  await db
    .update(venues)
    .set({ ...parsed.data, telefone: normalizeTelefone(parsed.data.telefone) })
    .where(eq(venues.id, id));
  revalidatePath("/casas");
  revalidatePath(`/casas/${id}`);
  redirect("/casas");
}

export async function deleteCasaAction(id: string) {
  await requireAdmin();
  try {
    await db.delete(venues).where(eq(venues.id, id));
    revalidatePath("/casas");
  } catch (err) {
    return {
      error:
        "Não foi possível excluir — provavelmente há shows ligados a esta casa.",
    };
  }
}
