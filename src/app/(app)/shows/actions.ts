"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { shows, venues } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin } from "@/lib/auth";
import { parseBRDateTime, formatDataBR } from "@/lib/formatters";
import { sendPushToAll } from "@/lib/push";

const SHOW_STATUSES = ["planejado", "confirmado", "concluido", "cancelado"] as const;
const PAGAMENTO_STATUSES = ["pendente", "parcial", "pago", "atrasado"] as const;

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const horaOptional = z
  .string()
  .regex(HORA_RE, "Use HH:mm")
  .optional()
  .or(z.literal("").transform(() => undefined));

const showSchema = z.object({
  casaId: z.string().min(1, "Selecione a casa"),
  // datetime-local interpretado como horário de Brasília (não do servidor).
  data: z
    .string()
    .min(1, "Informe a data e hora")
    .transform((s) => parseBRDateTime(s)),
  termino: horaOptional,
  passagemSom: horaOptional,
  contatoNome: z.string().max(80).optional(),
  contatoTelefone: z.string().max(40).optional(),
  endereco: z.string().max(300).optional(),
  cidade: z.string().max(80).optional(),
  estado: z.string().max(40).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  cacheReais: z.coerce.number().min(0).optional(),
  pagamentoStatus: z.enum(PAGAMENTO_STATUSES),
  publicoEsperado: z.coerce.number().int().min(0).optional(),
  duracaoMin: z.coerce.number().int().min(0).max(600).optional(),
  consumacao: z.string().max(300).optional(),
  acompanhantes: z.string().max(300).optional(),
  observacoes: z.string().max(2000).optional(),
  status: z.enum(SHOW_STATUSES),
});

function toPersist(d: z.infer<typeof showSchema>) {
  const { cacheReais, ...rest } = d;
  return {
    ...rest,
    cacheCentavos: cacheReais != null ? Math.round(cacheReais * 100) : 0,
  };
}

export async function createShowAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(showSchema, formData);
  if (!parsed.ok) return parsed.state;
  const [row] = await db.insert(shows).values(toPersist(parsed.data)).returning();

  // Avisa a banda automaticamente sobre o novo show (não bloqueia se falhar).
  try {
    const [casa] = await db
      .select({ nome: venues.nome })
      .from(venues)
      .where(eq(venues.id, row.casaId))
      .limit(1);
    await sendPushToAll({
      title: `Novo show: ${casa?.nome ?? "show"}`,
      body: `${formatDataBR(row.data, true)}${
        row.termino ? ` até ${row.termino}` : ""
      } — confirme sua presença!`,
      url: `/shows/${row.id}`,
      tag: `show-${row.id}`,
    });
  } catch (e) {
    console.error("push (novo show) falhou:", e);
  }

  revalidatePath("/shows");
  revalidatePath("/");
  redirect(`/shows/${row.id}`);
}

export async function updateShowAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(showSchema, formData);
  if (!parsed.ok) return parsed.state;
  await db.update(shows).set(toPersist(parsed.data)).where(eq(shows.id, id));
  revalidatePath("/shows");
  revalidatePath(`/shows/${id}`);
  revalidatePath("/");
  redirect(`/shows/${id}`);
}

export async function deleteShowAction(id: string) {
  await requireAdmin();
  await db.delete(shows).where(eq(shows.id, id));
  revalidatePath("/shows");
  revalidatePath("/");
}

export async function updateShowStatusAction(
  id: string,
  status: typeof SHOW_STATUSES[number]
) {
  await requireAdmin();
  await db.update(shows).set({ status }).where(eq(shows.id, id));
  revalidatePath("/shows");
  revalidatePath(`/shows/${id}`);
  revalidatePath("/");
}
