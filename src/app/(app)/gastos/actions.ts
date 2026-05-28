"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { gastos } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";
import { parseBRDateTime } from "@/lib/formatters";

const MAX_COMPROVANTE = 4_000_000; // ~4MB de data URL

const schema = z
  .object({
    tipo: z.enum(["show", "extra"]),
    showId: z.string().optional(),
    descricao: z.string().trim().min(2, "Descreva o gasto").max(300),
    recipient: z.string().trim().min(1, "Para quem foi?").max(120),
    valorReais: z.coerce.number().positive("Informe o valor pago"),
    paidEm: z
      .string()
      .min(1, "Informe a data/hora do pagamento")
      .transform((s) => parseBRDateTime(s)),
    comprovante: z.string().min(1, "Anexe o comprovante PIX"),
  })
  .refine((d) => d.tipo !== "show" || (d.showId && d.showId.length > 0), {
    path: ["showId"],
    message: "Selecione o show",
  });

export async function createGastoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await requireCurrentUser();
  if (me.role !== "admin") return { error: "Apenas admins registram gastos." };

  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const d = parsed.data;

  if (!d.comprovante.startsWith("data:")) {
    return { error: "Anexe o comprovante PIX." };
  }
  if (d.comprovante.length > MAX_COMPROVANTE) {
    return { error: "Comprovante muito grande. Use uma imagem menor." };
  }

  await db.insert(gastos).values({
    tipo: d.tipo,
    showId: d.tipo === "show" ? (d.showId ?? null) : null,
    descricao: d.descricao,
    recipient: d.recipient,
    valorCentavos: Math.round(d.valorReais * 100),
    comprovante: d.comprovante,
    paidEm: d.paidEm,
    createdBy: me.id,
  });

  revalidatePath("/gastos");
  redirect("/gastos");
}

export async function deleteGastoAction(id: string) {
  await requireAdmin();
  await db.delete(gastos).where(eq(gastos.id, id));
  revalidatePath("/gastos");
  return { ok: true };
}

export async function getGastoComprovanteAction(
  gastoId: string
): Promise<{ url: string | null; error?: string }> {
  await requireCurrentUser();
  const [row] = await db
    .select({ comprovante: gastos.comprovante })
    .from(gastos)
    .where(eq(gastos.id, gastoId))
    .limit(1);
  return { url: row?.comprovante ?? null };
}
