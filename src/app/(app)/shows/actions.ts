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
import { notifyEventChange } from "@/lib/event-push";

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
  privado: z.coerce.boolean().optional(),
  lembreteNivel: z.enum(["off", "tranquila", "importante", "urgente"]).optional(),
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
  valorIngresso: z.string().max(60).optional(),
  linkVendas: z.string().max(500).optional(),
  observacoes: z.string().max(2000).optional(),
  publicoPerfil: z.string().max(500).optional(),
  equipamentoVocal: z.string().max(120).optional(),
  status: z.enum(SHOW_STATUSES),
});

function toPersist(d: z.infer<typeof showSchema>) {
  const { cacheReais, ...rest } = d;
  return {
    ...rest,
    privado: !!d.privado, // sempre boolean (desmarcar precisa gravar false)
    lembreteNivel: d.lembreteNivel ?? "off",
    cacheCentavos: cacheReais != null ? Math.round(cacheReais * 100) : 0,
  };
}

export async function createShowAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = parseForm(showSchema, formData);
  if (!parsed.ok) return parsed.state;
  const nivel = parsed.data.lembreteNivel ?? "off";
  const [row] = await db
    .insert(shows)
    .values({
      ...toPersist(parsed.data),
      // O aviso de criação (push abaixo) conta como o 1º reforço.
      ...(nivel !== "off" ? { lembreteEnviadoEm: new Date(), lembretesEnviados: 1 } : {}),
    })
    .returning();

  // Avisa a banda automaticamente sobre o novo show (não bloqueia se falhar).
  try {
    const [casa] = await db
      .select({ nome: venues.nome })
      .from(venues)
      .where(eq(venues.id, row.casaId))
      .limit(1);
    await notifyEventChange({
      kind: "show",
      eventId: row.id,
      eventDate: row.data,
      exceptUserId: actor.id,
      payload: {
        title: `Novo show: ${casa?.nome ?? "show"}`,
        body: `${formatDataBR(row.data, true)}${
          row.termino ? ` até ${row.termino}` : ""
        } — confirme sua presença!`,
        url: `/shows/${row.id}`,
        tag: `show-${row.id}`,
      },
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
  const actor = await requireAdmin();
  const parsed = parseForm(showSchema, formData);
  if (!parsed.ok) return parsed.state;

  const [before] = await db
    .select()
    .from(shows)
    .where(eq(shows.id, id))
    .limit(1);
  const next = toPersist(parsed.data);
  await db.update(shows).set(next).where(eq(shows.id, id));

  // Avisa só quando muda algo RELEVANTE (data, horário, casa, status).
  try {
    if (before) {
      const cancelou =
        next.status === "cancelado" && before.status !== "cancelado";
      const relevante =
        cancelou ||
        before.data.getTime() !== next.data.getTime() ||
        before.termino !== next.termino ||
        before.passagemSom !== next.passagemSom ||
        before.casaId !== next.casaId ||
        before.status !== next.status;
      if (relevante) {
        const [casa] = await db
          .select({ nome: venues.nome })
          .from(venues)
          .where(eq(venues.id, next.casaId))
          .limit(1);
        const nomeCasa = casa?.nome ?? "show";
        await notifyEventChange({
          kind: "show",
          eventId: id,
          eventDate: next.data,
          exceptUserId: actor.id,
          payload: cancelou
            ? {
                title: `Show cancelado: ${nomeCasa}`,
                body: `${formatDataBR(next.data, true)} foi cancelado.`,
                url: `/shows/${id}`,
                tag: `show-${id}`,
              }
            : {
                title: `Show atualizado: ${nomeCasa}`,
                body: `${formatDataBR(next.data, true)}${
                  next.termino ? ` até ${next.termino}` : ""
                } — confira os detalhes.`,
                url: `/shows/${id}`,
                tag: `show-${id}`,
              },
        });
      }
    }
  } catch (e) {
    console.error("push (show atualizado) falhou:", e);
  }

  revalidatePath("/shows");
  revalidatePath(`/shows/${id}`);
  revalidatePath("/");
  redirect(`/shows/${id}`);
}

export async function deleteShowAction(id: string) {
  await requireAdmin();
  // Apagar NÃO dispara push (só cancelar via status). Decisão do usuário.
  await db.delete(shows).where(eq(shows.id, id));
  revalidatePath("/shows");
  revalidatePath("/");
}

export async function updateShowStatusAction(
  id: string,
  status: typeof SHOW_STATUSES[number]
) {
  const actor = await requireAdmin();
  const [before] = await db
    .select()
    .from(shows)
    .where(eq(shows.id, id))
    .limit(1);
  await db.update(shows).set({ status }).where(eq(shows.id, id));

  // Push só quando o show passa a CANCELADO (não em outras mudanças de status).
  if (status === "cancelado" && before && before.status !== "cancelado") {
    try {
      const [casa] = await db
        .select({ nome: venues.nome })
        .from(venues)
        .where(eq(venues.id, before.casaId))
        .limit(1);
      await notifyEventChange({
        kind: "show",
        eventId: id,
        eventDate: before.data,
        exceptUserId: actor.id,
        payload: {
          title: `Show cancelado: ${casa?.nome ?? "show"}`,
          body: `${formatDataBR(before.data, true)} foi cancelado.`,
          url: `/shows/${id}`,
          tag: `show-${id}`,
        },
      });
    } catch (e) {
      console.error("push (show cancelado) falhou:", e);
    }
  }

  revalidatePath("/shows");
  revalidatePath(`/shows/${id}`);
  revalidatePath("/");
}
