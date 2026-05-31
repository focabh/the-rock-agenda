// Carrega + agrega os números financeiros do ano. Fonte única usada pela tela
// /financeiro e pela exportação CSV (pra os valores nunca divergirem).
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  shows,
  members,
  showMemberPresence,
  showMemberPayment,
  gastos,
  reembolsos,
} from "@/db/schema";
import { computePaymentBreakdown } from "@/lib/payment";

export const MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export type FinanceReport = {
  anos: number[];
  ano: number;
  entradas: number;
  gastosTotal: number;
  gastosShow: number;
  gastosExtra: number;
  reembolsosTotal: number;
  managerTotal: number;
  liquido: number;
  aReceber: number;
  perMember: { id: string; nome: string; total: number; shows: number }[];
  topVenues: { nome: string; total: number; avg: number; count: number }[];
  months: { label: string; entradas: number; saidas: number }[];
  membros: { id: string; nome: string }[];
};

export async function loadFinanceReport(anoParam?: string): Promise<FinanceReport> {
  const allMembers = await db.select().from(members);
  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  const managerMember = allMembers.find((m) => m.isManager) ?? null;
  const playable = allMembers.filter((m) => !m.isManager && m.ativo);

  const allShows = await db.query.shows.findMany({
    with: { casa: { columns: { nome: true } } },
  });

  const anosSet = new Set<number>([new Date().getFullYear()]);
  for (const s of allShows) anosSet.add(s.data.getFullYear());
  const anos = [...anosSet].sort((a, b) => b - a);
  const ano = anoParam && anos.includes(Number(anoParam)) ? Number(anoParam) : anos[0];

  const showsAno = allShows.filter((s) => s.data.getFullYear() === ano);
  const realizados = showsAno.filter(
    (s) => s.status === "concluido" && (s.cacheCentavos ?? 0) > 0
  );
  const ids = realizados.map((s) => s.id);

  const [presences, overrides, gastoRows, reembolsoRows] = await Promise.all([
    ids.length ? db.select().from(showMemberPresence).where(inArray(showMemberPresence.showId, ids)) : Promise.resolve([] as (typeof showMemberPresence.$inferSelect)[]),
    ids.length ? db.select().from(showMemberPayment).where(inArray(showMemberPayment.showId, ids)) : Promise.resolve([] as (typeof showMemberPayment.$inferSelect)[]),
    db.select().from(gastos),
    db.select().from(reembolsos),
  ]);

  const confirmedByShow = new Map<string, Set<string>>();
  for (const p of presences) {
    if (p.status !== "confirmado") continue;
    if (!confirmedByShow.has(p.showId)) confirmedByShow.set(p.showId, new Set());
    confirmedByShow.get(p.showId)!.add(p.memberId);
  }
  const overridesByShow = new Map<string, Map<string, number>>();
  for (const o of overrides) {
    if (!overridesByShow.has(o.showId)) overridesByShow.set(o.showId, new Map());
    overridesByShow.get(o.showId)!.set(o.memberId, o.valorCentavos);
  }

  let entradas = 0;
  let managerTotal = 0;
  const perMember = new Map<string, number>();
  const perMemberShows = new Map<string, number>();
  const venueAgg = new Map<string, { sum: number; count: number }>();
  const mesEntradas = Array(12).fill(0);

  for (const s of realizados) {
    entradas += s.cacheCentavos ?? 0;
    mesEntradas[s.data.getMonth()] += s.cacheCentavos ?? 0;
    const va = venueAgg.get(s.casa.nome) ?? { sum: 0, count: 0 };
    va.sum += s.cacheCentavos ?? 0;
    va.count++;
    venueAgg.set(s.casa.nome, va);

    const confirmados = playable.filter((m) =>
      (confirmedByShow.get(s.id) ?? new Set<string>()).has(m.id)
    );
    if (confirmados.length === 0) continue;
    const bd = computePaymentBreakdown({
      cacheCentavos: s.cacheCentavos ?? 0,
      applyCommission: s.applyCommission,
      commissionPct: s.commissionPct,
      confirmedMusicos: confirmados,
      managerMember,
      overrides: overridesByShow.get(s.id) ?? new Map(),
    });
    managerTotal += bd.managerCentavos;
    for (const [mid, info] of bd.perMember) {
      perMember.set(mid, (perMember.get(mid) ?? 0) + info.valorCentavos);
      perMemberShows.set(mid, (perMemberShows.get(mid) ?? 0) + 1);
    }
  }

  const aReceber = showsAno
    .filter((s) => s.status === "concluido" && s.pagamentoStatus !== "pago")
    .reduce((t, s) => t + (s.cacheCentavos ?? 0), 0);

  const gastosAno = gastoRows.filter((g) => g.paidEm.getFullYear() === ano);
  const gastosTotal = gastosAno.reduce((t, g) => t + g.valorCentavos, 0);
  const gastosShow = gastosAno.filter((g) => g.tipo === "show").reduce((t, g) => t + g.valorCentavos, 0);
  const gastosExtra = gastosTotal - gastosShow;
  const mesSaidas = Array(12).fill(0);
  for (const g of gastosAno) mesSaidas[g.paidEm.getMonth()] += g.valorCentavos;

  const reembolsosAno = reembolsoRows.filter((r) => r.paidEm.getFullYear() === ano);
  const reembolsosTotal = reembolsosAno.reduce((t, r) => t + r.valorCentavos, 0);
  for (const r of reembolsosAno) mesSaidas[r.paidEm.getMonth()] += r.valorCentavos;

  return {
    anos,
    ano,
    entradas,
    gastosTotal,
    gastosShow,
    gastosExtra,
    reembolsosTotal,
    managerTotal,
    liquido: entradas - gastosTotal,
    aReceber,
    perMember: [...perMember.entries()]
      .map(([id, total]) => ({ id, nome: memberById.get(id)?.nome ?? "—", total, shows: perMemberShows.get(id) ?? 0 }))
      .sort((a, b) => b.total - a.total),
    topVenues: [...venueAgg.entries()]
      .map(([nome, v]) => ({ nome, total: v.sum, avg: Math.round(v.sum / v.count), count: v.count }))
      .sort((a, b) => b.total - a.total),
    months: MES.map((label, i) => ({ label, entradas: mesEntradas[i], saidas: mesSaidas[i] })),
    membros: allMembers.map((m) => ({ id: m.id, nome: m.nome })),
  };
}
