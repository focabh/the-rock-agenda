"use server";

import { eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { shows, venues, equipamentos } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { checkCompat } from "@/lib/show-compat";
import { NoApiKeyError } from "@/lib/venue-ai";
import { TIPO_LABEL } from "@/lib/equipamentos";

export async function checkShowCompatAction(showId: string): Promise<{
  ok: boolean;
  parecer?: string;
  error?: string;
  needsKey?: boolean;
}> {
  await requireAdmin();
  const [show] = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
  if (!show) return { ok: false, error: "Show não encontrado." };
  const [casa] = await db.select().from(venues).where(eq(venues.id, show.casaId)).limit(1);
  const venueInfra = casa?.infraestrutura?.trim() ?? "";
  if (!venueInfra)
    return {
      ok: false,
      error: "A casa não tem infraestrutura cadastrada — edite a casa e informe o que ela oferece.",
    };

  // Infra coletiva da banda (proprietário null OU categoria coletiva).
  const rows = await db
    .select()
    .from(equipamentos)
    .where(or(eq(equipamentos.categoria, "infraestrutura_coletiva"), isNull(equipamentos.proprietarioId)));
  const bandInfra = rows
    .map((e) => `${e.nome} (${TIPO_LABEL[e.tipo]}${e.especificacoes ? `, ${e.especificacoes}` : ""})`)
    .join("; ");

  try {
    const parecer = await checkCompat(bandInfra, venueInfra);
    return { ok: true, parecer };
  } catch (e) {
    if (e instanceof NoApiKeyError) return { ok: false, needsKey: true, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Falha." };
  }
}
