"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { venueEvaluations, showPropostas, shows, venues } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { formatBRL, formatDataBR } from "@/lib/formatters";
import { requireAdmin } from "@/lib/auth";

const avaliacaoSchema = z.object({
  notaGeral: z.coerce.number().int().min(1).max(5).optional(),
  tocariaNovamente: z
    .union([z.literal("sim"), z.literal("nao"), z.literal("")])
    .transform((v) => (v === "sim" ? true : v === "nao" ? false : null)),
  observacoes: z.string().max(2000).optional(),
});

export async function saveAvaliacaoAction(
  showId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(avaliacaoSchema, formData);
  if (!parsed.ok) return parsed.state;
  const existing = await db.query.venueEvaluations.findFirst({
    where: eq(venueEvaluations.showId, showId),
  });
  if (existing) {
    await db
      .update(venueEvaluations)
      .set(parsed.data)
      .where(eq(venueEvaluations.id, existing.id));
  } else {
    await db.insert(venueEvaluations).values({ showId, ...parsed.data });
  }
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/casas");
  return { error: undefined };
}

export async function savePropostaAction(showId: string, corpoMarkdown: string) {
  await requireAdmin();
  const existing = await db.query.showPropostas.findFirst({
    where: eq(showPropostas.showId, showId),
  });
  if (existing) {
    await db
      .update(showPropostas)
      .set({ corpoMarkdown })
      .where(eq(showPropostas.id, existing.id));
  } else {
    await db.insert(showPropostas).values({ showId, corpoMarkdown });
  }
  revalidatePath(`/shows/${showId}`);
}

export async function generateDefaultPropostaAction(showId: string): Promise<string> {
  await requireAdmin();
  const [show] = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
  if (!show) return "";
  const [casa] = await db.select().from(venues).where(eq(venues.id, show.casaId)).limit(1);
  if (!casa) return "";

  const cache = show.cacheCentavos > 0 ? formatBRL(show.cacheCentavos) : "_a combinar_";

  const md = `# Proposta de apresentação — The Rock

**Para:** ${casa.nome}${casa.bairro ? " — " + casa.bairro : ""}
**Contato:** ${show.contatoNome ?? casa.contatoPrincipal ?? ""} ${show.contatoTelefone ? "— " + show.contatoTelefone : ""}

**Data:** ${formatDataBR(show.data, true)}
**Horário do show:** ${show.inicio ?? "—"} às ${show.termino ?? "—"}
**Passagem de som:** ${show.passagemSom ?? "a combinar"}

## Cachê
${cache}, pagamento via PIX ao final do show.

## Formato
Banda de rock cover (90s e 2000s — Foo Fighters, RHCP, Nirvana, Linkin Park, Pearl Jam, etc.). 4 músicos. Repertório de cerca de 1h30 dividido em 2 sets, ou setlist único conforme combinado.

## Cancelamento
- Cancelamento pela casa com até 7 dias: sem custo.
- Cancelamento pela casa entre 48h e 7 dias: 50% do cachê.
- Cancelamento pela casa com menos de 48h: 100% do cachê.

## Estrutura
A casa fornece: PA adequado ao espaço, monitores, mesa de som com operador.
A banda traz: instrumentos, pedais, cabos próprios.

## Uso de imagem
Autorização para a casa publicar fotos e vídeos do show, com crédito @therock.

---

_____________________________
${casa.nome} — Contratante

_____________________________
The Rock — Banda
`;

  await savePropostaAction(showId, md);
  return md;
}
