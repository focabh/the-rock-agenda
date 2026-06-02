// Carrega + agrega o controle financeiro do ano — modelo de CAIXA + REPASSE,
// sem buracos. Distingue: faturado (billing) × recebido (entrou no caixa) ×
// devido aos músicos × repassado × a repassar. Fonte única (tela + CSV).
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  members,
  showMemberPresence,
  showMemberPayment,
  showMemberPaid,
  showSubstitute,
  gastos,
  reembolsos,
} from "@/db/schema";
import { computePaymentBreakdown } from "@/lib/payment";

export const MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export type FinanceMember = {
  id: string;
  nome: string;
  isManager: boolean;
  devido: number;
  repassado: number;
  aReceber: number; // devido - repassado (banda deve a ele)
  shows: number;
};

export type FinanceReport = {
  anos: number[];
  ano: number;
  // Entradas (contratante → banda)
  faturado: number; // Σ cachê dos shows comprometidos (confirmado + concluído)
  realizado: number; // Σ cachê de shows CONCLUÍDOS (renda realizada)
  esperado: number; // Σ cachê de shows CONFIRMADOS ainda não realizados (prospecção)
  recebido: number; // entrou no caixa (pagamentoStatus = pago)
  aReceberContratante: number; // comprometido mas não pago
  // Distribuição (banda → músicos/manager)
  devidoMusicos: number;
  repassadoMusicos: number;
  aRepassarMusicos: number;
  managerTotal: number;
  // Saídas operacionais
  gastosTotal: number;
  gastosShow: number;
  gastosExtra: number;
  reembolsosTotal: number;
  // Caixa
  saldoCaixa: number; // recebido − repassado − gastos − reembolsos
  perMember: FinanceMember[];
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
  // Shows com movimentação financeira = comprometidos (confirmado OU concluído).
  const considera = showsAno.filter(
    (s) => (s.status === "confirmado" || s.status === "concluido") && (s.cacheCentavos ?? 0) > 0
  );
  const ids = considera.map((s) => s.id);

  const [presences, overrides, paidRows, subRows, gastoRows, reembolsoRows] = await Promise.all([
    ids.length ? db.select().from(showMemberPresence).where(inArray(showMemberPresence.showId, ids)) : Promise.resolve([] as (typeof showMemberPresence.$inferSelect)[]),
    ids.length ? db.select().from(showMemberPayment).where(inArray(showMemberPayment.showId, ids)) : Promise.resolve([] as (typeof showMemberPayment.$inferSelect)[]),
    ids.length ? db.select().from(showMemberPaid).where(inArray(showMemberPaid.showId, ids)) : Promise.resolve([] as (typeof showMemberPaid.$inferSelect)[]),
    ids.length ? db.select().from(showSubstitute).where(inArray(showSubstitute.showId, ids)) : Promise.resolve([] as (typeof showSubstitute.$inferSelect)[]),
    db.select().from(gastos),
    db.select().from(reembolsos),
  ]);

  const confirmedByShow = new Map<string, Set<string>>();
  for (const p of presences) {
    if (p.status !== "confirmado") continue;
    if (!confirmedByShow.has(p.showId)) confirmedByShow.set(p.showId, new Set());
    confirmedByShow.get(p.showId)!.add(p.memberId);
  }
  // Overrides crus por show (resolvemos o % com base no cachê dentro do loop).
  const overrideRowsByShow = new Map<string, typeof overrides>();
  for (const o of overrides) {
    if (!overrideRowsByShow.has(o.showId)) overrideRowsByShow.set(o.showId, []);
    overrideRowsByShow.get(o.showId)!.push(o);
  }
  // Subs convidados por show (entram na divisão como participantes).
  const subsByShow = new Map<string, typeof subRows>();
  for (const su of subRows) {
    if (!subsByShow.has(su.showId)) subsByShow.set(su.showId, []);
    subsByShow.get(su.showId)!.push(su);
  }
  // Repasse banda→músico considerado feito quando a linha existe (legada/null =
  // quitada) ou status confirmado.
  const repassadoSet = new Set<string>();
  for (const r of paidRows) {
    if (r.status == null || r.status === "confirmado") repassadoSet.add(`${r.showId}-${r.memberId}`);
  }

  let realizado = 0;
  let esperado = 0;
  let recebido = 0;
  let managerTotal = 0;
  const devidoM = new Map<string, number>();
  const repassadoM = new Map<string, number>();
  const showsM = new Map<string, number>();
  const venueAgg = new Map<string, { sum: number; count: number }>();
  const mesEntradas = Array(12).fill(0);

  for (const s of considera) {
    const c = s.cacheCentavos ?? 0;
    if (s.status === "concluido") realizado += c;
    else esperado += c; // confirmado (a realizar)
    const pago = s.pagamentoStatus === "pago";
    if (pago) {
      recebido += c;
      mesEntradas[s.data.getMonth()] += c;
    }
    const va = venueAgg.get(s.casa.nome) ?? { sum: 0, count: 0 };
    va.sum += c;
    va.count++;
    venueAgg.set(s.casa.nome, va);

    // Dívida com músicos/manager só existe depois que o show ACONTECEU
    // (participou). Show futuro confirmado é só renda esperada da banda.
    if (s.status !== "concluido") continue;

    const confirmados = playable.filter((m) =>
      (confirmedByShow.get(s.id) ?? new Set<string>()).has(m.id)
    );
    const subsShow = subsByShow.get(s.id) ?? [];
    if (confirmados.length === 0 && subsShow.length === 0) continue;
    // Resolve overrides (valor fixo OU % do cachê deste show).
    const ovMap = new Map<string, number>();
    for (const o of overrideRowsByShow.get(s.id) ?? []) {
      ovMap.set(o.memberId, o.pct != null ? Math.round((c * o.pct) / 100) : o.valorCentavos);
    }
    // Participantes da divisão = músicos confirmados + subs convidados.
    const participantes = [
      ...confirmados.map((m) => ({ id: m.id })),
      ...subsShow.map((su) => ({ id: su.id })),
    ];
    const bd = computePaymentBreakdown({
      cacheCentavos: c,
      applyCommission: s.applyCommission,
      commissionPct: s.commissionPct,
      confirmedMusicos: participantes,
      managerMember,
      overrides: ovMap,
    });
    managerTotal += bd.managerCentavos;
    for (const [mid, info] of bd.perMember) {
      // Subs não são membros da banda — não entram na tabela por músico.
      if (!memberById.has(mid)) continue;
      devidoM.set(mid, (devidoM.get(mid) ?? 0) + info.valorCentavos);
      showsM.set(mid, (showsM.get(mid) ?? 0) + 1);
      if (repassadoSet.has(`${s.id}-${mid}`))
        repassadoM.set(mid, (repassadoM.get(mid) ?? 0) + info.valorCentavos);
    }
    // A comissão também é renda — da PESSOA que é manager. Entra como destinatário.
    if (managerMember && bd.managerCentavos > 0) {
      const mid = managerMember.id;
      devidoM.set(mid, (devidoM.get(mid) ?? 0) + bd.managerCentavos);
      showsM.set(mid, (showsM.get(mid) ?? 0) + 1);
      if (repassadoSet.has(`${s.id}-${mid}`))
        repassadoM.set(mid, (repassadoM.get(mid) ?? 0) + bd.managerCentavos);
    }
  }

  // A receber do contratante = comprometido (confirmado/concluído) e ainda não pago.
  const aReceberContratante = considera
    .filter((s) => s.pagamentoStatus !== "pago")
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

  const perMember: FinanceMember[] = [...devidoM.entries()]
    .map(([id, devido]) => {
      const repassado = repassadoM.get(id) ?? 0;
      return {
        id,
        nome: memberById.get(id)?.nome ?? "—",
        isManager: memberById.get(id)?.isManager ?? false,
        devido,
        repassado,
        aReceber: Math.max(0, devido - repassado),
        shows: showsM.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.devido - a.devido);

  // "Músicos" exclui o manager (a comissão dele tem o card próprio).
  const devidoMusicos = perMember.filter((m) => !m.isManager).reduce((t, m) => t + m.devido, 0);
  const repassadoMusicos = perMember.filter((m) => !m.isManager).reduce((t, m) => t + m.repassado, 0);

  return {
    anos,
    ano,
    faturado: realizado + esperado,
    realizado,
    esperado,
    recebido,
    aReceberContratante,
    devidoMusicos,
    repassadoMusicos,
    aRepassarMusicos: Math.max(0, devidoMusicos - repassadoMusicos),
    managerTotal,
    gastosTotal,
    gastosShow,
    gastosExtra,
    reembolsosTotal,
    saldoCaixa: recebido - repassadoMusicos - gastosTotal - reembolsosTotal,
    perMember,
    topVenues: [...venueAgg.entries()]
      .map(([nome, v]) => ({ nome, total: v.sum, avg: Math.round(v.sum / v.count), count: v.count }))
      .sort((a, b) => b.total - a.total),
    months: MES.map((label, i) => ({ label, entradas: mesEntradas[i], saidas: mesSaidas[i] })),
    membros: allMembers.map((m) => ({ id: m.id, nome: m.nome })),
  };
}
