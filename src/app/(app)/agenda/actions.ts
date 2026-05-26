"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { memberUnavailability, rehearsals } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin, requireCurrentUser } from "@/lib/auth";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .transform((s) => {
    const [y, m, d] = s.split("-").map(Number);
    // meio-dia UTC evita ambiguidade de fuso (cai no dia certo em qualquer timezone)
    return new Date(Date.UTC(y, m - 1, d, 12));
  });

const unavailSchema = z
  .object({
    memberId: z.string().min(1, "Selecione o membro"),
    dataInicio: dateOnly,
    dataFim: dateOnly,
    motivo: z.string().max(200).optional(),
  })
  .refine((d) => d.dataFim.getTime() >= d.dataInicio.getTime(), {
    path: ["dataFim"],
    message: "Data fim deve ser igual ou posterior à data início",
  });

export async function createUnavailabilityAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  const parsed = parseForm(unavailSchema, formData);
  if (!parsed.ok) return parsed.state;

  // Admin pode bloquear qualquer um; membro só o próprio
  if (user.role !== "admin" && user.member?.id !== parsed.data.memberId) {
    return { error: "Você só pode bloquear datas no próprio perfil." };
  }

  await db.insert(memberUnavailability).values({
    memberId: parsed.data.memberId,
    dataInicio: parsed.data.dataInicio,
    dataFim: parsed.data.dataFim,
    motivo: parsed.data.motivo,
  });
  revalidatePath("/agenda");
  revalidatePath(`/banda/${parsed.data.memberId}`);
  revalidatePath("/");
  revalidatePath("/shows");
  return null;
}

// ---------------- ENSAIOS (REHEARSALS) ----------------

const timeOnly = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Horário inválido (HH:mm)")
  .optional();

const rehearsalSchema = z.object({
  data: dateOnly,
  inicio: timeOnly,
  termino: timeOnly,
  local: z.string().max(200).optional(),
  foco: z.string().max(300).optional(),
  observacoes: z.string().max(1000).optional(),
  status: z.enum(["planejado", "confirmado", "cancelado"]).default("planejado"),
});

function revalidateRehearsalPaths() {
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function createRehearsalAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(rehearsalSchema, formData);
  if (!parsed.ok) return parsed.state;

  await db.insert(rehearsals).values({
    data: parsed.data.data,
    inicio: parsed.data.inicio,
    termino: parsed.data.termino,
    local: parsed.data.local,
    foco: parsed.data.foco,
    observacoes: parsed.data.observacoes,
    status: parsed.data.status,
  });
  revalidateRehearsalPaths();
  return null;
}

export async function updateRehearsalAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(rehearsalSchema, formData);
  if (!parsed.ok) return parsed.state;

  await db
    .update(rehearsals)
    .set({
      data: parsed.data.data,
      inicio: parsed.data.inicio,
      termino: parsed.data.termino,
      local: parsed.data.local,
      foco: parsed.data.foco,
      observacoes: parsed.data.observacoes,
      status: parsed.data.status,
    })
    .where(eq(rehearsals.id, id));
  revalidateRehearsalPaths();
  return null;
}

export async function deleteRehearsalAction(id: string) {
  await requireAdmin();
  await db.delete(rehearsals).where(eq(rehearsals.id, id));
  revalidateRehearsalPaths();
}

export async function deleteUnavailabilityAction(id: string) {
  const user = await requireCurrentUser();
  const [row] = await db
    .select({ memberId: memberUnavailability.memberId })
    .from(memberUnavailability)
    .where(eq(memberUnavailability.id, id))
    .limit(1);
  if (!row) return;
  if (user.role !== "admin" && user.member?.id !== row.memberId) {
    return { error: "Sem permissão." };
  }
  await db.delete(memberUnavailability).where(eq(memberUnavailability.id, id));
  revalidatePath("/agenda");
  if (row) revalidatePath(`/banda/${row.memberId}`);
  revalidatePath("/");
  revalidatePath("/shows");
}
