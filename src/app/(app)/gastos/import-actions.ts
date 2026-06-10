"use server";

import { db } from "@/db";
import { gastos } from "@/db/schema";
import { requireCurrentUser, isAdmin } from "@/lib/auth";
import { mapFinancialRowsWithAI, type MappedGasto } from "@/lib/financial-import";
import { IMPORTED_NO_RECEIPT } from "@/lib/comprovante";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const u = await requireCurrentUser();
  if (!isAdmin(u)) throw new Error("Sem permissão.");
  return u;
}

/** Manda a planilha bruta pra IA estruturar os gastos. Não grava nada ainda. */
export async function analyzeFinancialAction(
  text: string
): Promise<{ ok: true; rows: MappedGasto[] } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const rows = await mapFinancialRowsWithAI(text, Date.now());
    if (rows.length === 0) return { ok: false, error: "Não encontrei gastos no texto." };
    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao analisar.";
    return { ok: false, error: msg };
  }
}

/** Grava os gastos confirmados, marcados como "importado sem comprovante". */
export async function importGastosAction(
  rows: MappedGasto[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const u = await requireAdmin();
  let count = 0;
  for (const r of rows) {
    if (!r.valorCentavos || r.valorCentavos <= 0) continue;
    const paidEm = new Date(r.paidEmISO);
    await db.insert(gastos).values({
      tipo: r.tipo === "show" ? "show" : "extra",
      descricao: r.descricao.slice(0, 200) || "Gasto importado",
      recipient: (r.recipient || r.descricao).slice(0, 200),
      valorCentavos: r.valorCentavos,
      comprovante: IMPORTED_NO_RECEIPT,
      paidEm: Number.isNaN(paidEm.getTime()) ? new Date() : paidEm,
      createdBy: u.id,
    });
    count++;
  }
  revalidatePath("/gastos");
  revalidatePath("/financeiro");
  return { ok: true, count };
}
