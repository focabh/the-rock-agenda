"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  memberUnavailability,
  rehearsals,
  rehearsalMemberPresence,
} from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireSuperuser, requireCurrentUser } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import { sendPushToAll } from "@/lib/push";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .transform((s) => {
    const [y, m, d] = s.split("-").map(Number);
    // meio-dia UTC evita ambiguidade de fuso (cai no dia certo em qualquer timezone)
    return new Date(Date.UTC(y, m - 1, d, 12));
  });

const timeOnly = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (HH:mm)")
  .optional();

const unavailSchema = z
  .object({
    memberId: z.string().min(1, "Selecione o membro"),
    dataInicio: dateOnly,
    dataFim: dateOnly,
    horaInicio: timeOnly,
    horaFim: timeOnly,
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
    horaInicio: parsed.data.horaInicio,
    horaFim: parsed.data.horaFim,
    motivo: parsed.data.motivo,
  });
  revalidatePath("/agenda");
  revalidatePath(`/banda/${parsed.data.memberId}`);
  revalidatePath("/");
  revalidatePath("/shows");
  return null;
}

// ---------------- ENSAIOS (REHEARSALS) ----------------

const rehearsalSchema = z.object({
  data: dateOnly,
  inicio: timeOnly,
  termino: timeOnly,
  local: z.string().max(200).optional(),
  endereco: z.string().max(300).optional(),
  cidade: z.string().max(80).optional(),
  estado: z.string().max(40).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  foco: z.string().max(300).optional(),
  observacoes: z.string().max(1000).optional(),
  showId: z.string().max(40).optional(),
  status: z.enum(["planejado", "confirmado", "cancelado"]).default("planejado"),
});

function revalidateRehearsalPaths() {
  revalidatePath("/agenda");
  revalidatePath("/ensaios");
  revalidatePath("/");
}

export async function createRehearsalAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperuser();
  const parsed = parseForm(rehearsalSchema, formData);
  if (!parsed.ok) return parsed.state;

  const [row] = await db
    .insert(rehearsals)
    .values({
      data: parsed.data.data,
      inicio: parsed.data.inicio,
      termino: parsed.data.termino,
      local: parsed.data.local,
      endereco: parsed.data.endereco,
      cidade: parsed.data.cidade,
      estado: parsed.data.estado,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      foco: parsed.data.foco,
      observacoes: parsed.data.observacoes,
      showId: parsed.data.showId || null,
      status: parsed.data.status,
    })
    .returning();

  // Avisa a banda automaticamente sobre o novo ensaio (não bloqueia se falhar).
  try {
    await sendPushToAll({
      title: "Novo ensaio",
      body: `${formatDataBR(row.data)}${row.inicio ? ` às ${row.inicio}` : ""}${
        row.local ? ` • ${row.local}` : ""
      } — confirme presença!`,
      url: `/ensaios/${row.id}`,
      tag: `ensaio-${row.id}`,
    });
  } catch (e) {
    console.error("push (novo ensaio) falhou:", e);
  }

  revalidateRehearsalPaths();
  return null;
}

export async function updateRehearsalAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperuser();
  const parsed = parseForm(rehearsalSchema, formData);
  if (!parsed.ok) return parsed.state;

  await db
    .update(rehearsals)
    .set({
      data: parsed.data.data,
      inicio: parsed.data.inicio,
      termino: parsed.data.termino,
      local: parsed.data.local,
      endereco: parsed.data.endereco,
      cidade: parsed.data.cidade,
      estado: parsed.data.estado,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      foco: parsed.data.foco,
      observacoes: parsed.data.observacoes,
      showId: parsed.data.showId || null,
      status: parsed.data.status,
    })
    .where(eq(rehearsals.id, id));
  revalidateRehearsalPaths();
  return null;
}

export async function deleteRehearsalAction(id: string) {
  await requireSuperuser();
  await db.delete(rehearsals).where(eq(rehearsals.id, id));
  revalidateRehearsalPaths();
}

const PRESENCE_STATUSES = ["pendente", "confirmado", "recusado"] as const;

export async function setRehearsalPresenceAction(
  rehearsalId: string,
  memberId: string,
  status: (typeof PRESENCE_STATUSES)[number]
) {
  const user = await requireCurrentUser();
  const isAdmin = user.role === "admin";
  const isSelf = user.member?.id === memberId;
  if (!isAdmin && !isSelf) {
    return { error: "Você só pode confirmar a própria presença." };
  }
  const existing = await db.query.rehearsalMemberPresence.findFirst({
    where: and(
      eq(rehearsalMemberPresence.rehearsalId, rehearsalId),
      eq(rehearsalMemberPresence.memberId, memberId)
    ),
  });
  if (existing) {
    await db
      .update(rehearsalMemberPresence)
      .set({ status })
      .where(eq(rehearsalMemberPresence.id, existing.id));
  } else {
    await db
      .insert(rehearsalMemberPresence)
      .values({ rehearsalId, memberId, status });
  }
  revalidatePath(`/ensaios/${rehearsalId}`);
  return { ok: true };
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
