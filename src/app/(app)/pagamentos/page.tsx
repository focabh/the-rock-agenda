import Link from "next/link";
import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import {
  shows,
  members,
  showMemberPresence,
  showMemberPayment,
  showMemberPaid,
  showSubstitute,
  reembolsos,
} from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Wallet } from "lucide-react";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import { computePaymentBreakdown, memberDefaultCentavos } from "@/lib/payment";
import { FinanceReport, type FinanceReportData } from "@/components/pagamentos/finance-report";
import {
  PagamentosHub,
  type CacheItem,
  type ReembolsoItem,
  type ContratanteItem,
} from "@/components/pagamentos/pagamentos-hub";

export default async function PagamentosPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const meMemberId = user?.member?.id ?? null;

  const allMembers = await db.select().from(members);
  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  const managerMember = allMembers.find((m) => m.isManager) ?? null;
  const playable = allMembers.filter((m) => !m.isManager && m.ativo);

  // Cachê a pagar a músico só depois que o show ACONTECEU (concluído). Show
  // futuro confirmado ainda não gera pagamento — é renda esperada (ver Financeiro).
  const payableShows = await db.query.shows.findMany({
    where: and(gt(shows.cacheCentavos, 0), eq(shows.status, "concluido")),
    with: { casa: { columns: { nome: true } } },
    orderBy: (s, { desc }) => [desc(s.data)],
  });
  const showIds = payableShows.map((s) => s.id);

  const [presences, overrides, paidRows, subRows] = await Promise.all([
    showIds.length
      ? db
          .select()
          .from(showMemberPresence)
          .where(inArray(showMemberPresence.showId, showIds))
      : Promise.resolve([] as (typeof showMemberPresence.$inferSelect)[]),
    showIds.length
      ? db
          .select()
          .from(showMemberPayment)
          .where(inArray(showMemberPayment.showId, showIds))
      : Promise.resolve([] as (typeof showMemberPayment.$inferSelect)[]),
    showIds.length
      ? db
          .select()
          .from(showMemberPaid)
          .where(inArray(showMemberPaid.showId, showIds))
      : Promise.resolve([] as (typeof showMemberPaid.$inferSelect)[]),
    showIds.length
      ? db
          .select()
          .from(showSubstitute)
          .where(inArray(showSubstitute.showId, showIds))
      : Promise.resolve([] as (typeof showSubstitute.$inferSelect)[]),
  ]);

  const confirmedByShow = new Map<string, Set<string>>();
  for (const p of presences) {
    if (p.status !== "confirmado") continue;
    if (!confirmedByShow.has(p.showId)) confirmedByShow.set(p.showId, new Set());
    confirmedByShow.get(p.showId)!.add(p.memberId);
  }

  const overrideRowsByShow = new Map<string, typeof overrides>();
  for (const o of overrides) {
    if (!overrideRowsByShow.has(o.showId)) overrideRowsByShow.set(o.showId, []);
    overrideRowsByShow.get(o.showId)!.push(o);
  }
  const subsByShow = new Map<string, typeof subRows>();
  for (const su of subRows) {
    if (!subsByShow.has(su.showId)) subsByShow.set(su.showId, []);
    subsByShow.get(su.showId)!.push(su);
  }

  // Resolve override (valor fixo OU % do cachê OU padrão do perfil) + a lista de
  // participantes da divisão (músicos confirmados + subs convidados), por show.
  function resolveShow(s: { id: string; cacheCentavos: number | null }) {
    const c = s.cacheCentavos ?? 0;
    const confirmados = playable.filter((m) =>
      (confirmedByShow.get(s.id) ?? new Set<string>()).has(m.id)
    );
    const ovMap = new Map<string, number>();
    for (const o of overrideRowsByShow.get(s.id) ?? [])
      ovMap.set(o.memberId, o.pct != null ? Math.round((c * o.pct) / 100) : o.valorCentavos);
    for (const m of confirmados) {
      if (ovMap.has(m.id)) continue;
      const d = memberDefaultCentavos(m, c);
      if (d != null) ovMap.set(m.id, d);
    }
    const subsShow = subsByShow.get(s.id) ?? [];
    const participantes = [
      ...confirmados.map((m) => ({ id: m.id })),
      ...subsShow.map((su) => ({ id: su.id })),
    ];
    return { confirmados, ovMap, participantes };
  }

  const paidByKey = new Map<
    string,
    { status: "aguardando" | "confirmado"; hasComprovante: boolean; pagoEm: Date }
  >();
  for (const r of paidRows) {
    paidByKey.set(`${r.showId}-${r.memberId}`, {
      status: (r.status ?? "confirmado") as "aguardando" | "confirmado",
      hasComprovante: Boolean(r.comprovante),
      pagoEm: r.pagoEm,
    });
  }

  // Constrói itens de cachê (uma linha por show × músico confirmado).
  const cacheItems: CacheItem[] = [];
  for (const s of payableShows) {
    const { confirmados, ovMap, participantes } = resolveShow(s);
    if (confirmados.length === 0) continue;

    const breakdown = computePaymentBreakdown({
      cacheCentavos: s.cacheCentavos ?? 0,
      applyCommission: s.applyCommission,
      commissionPct: s.commissionPct,
      confirmedMusicos: participantes,
      managerMember,
      overrides: ovMap,
    });

    for (const m of confirmados) {
      if (!admin && m.id !== meMemberId) continue;
      const info = breakdown.perMember.get(m.id);
      if (!info) continue;
      const paid = paidByKey.get(`${s.id}-${m.id}`);
      const status: CacheItem["status"] = !paid
        ? "a_pagar"
        : paid.status === "aguardando"
          ? "aguardando"
          : "confirmado";
      const mem = memberById.get(m.id);
      cacheItems.push({
        showId: s.id,
        showLabel: `${s.casa.nome} — ${formatDataBR(s.data)}`,
        showData: s.data.toISOString(),
        memberId: m.id,
        memberNome: mem?.nome ?? "—",
        valorCentavos: info.valorCentavos,
        status,
        hasComprovante: paid?.hasComprovante ?? false,
        pagoEmISO: paid?.pagoEm.toISOString() ?? null,
        chavePix: mem?.chavePix ?? null,
        pixTipo: mem?.pixTipo ?? null,
      });
    }
  }

  // Reembolsos
  const reembolsoRows = await db
    .select()
    .from(reembolsos)
    .orderBy(desc(reembolsos.paidEm));
  const reembolsoItems: ReembolsoItem[] = reembolsoRows
    .filter((r) => admin || r.memberId === meMemberId)
    .map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberNome: memberById.get(r.memberId)?.nome ?? "—",
      descricao: r.descricao,
      valorCentavos: r.valorCentavos,
      status: r.status,
      hasComprovante: Boolean(r.comprovante),
      paidEmISO: r.paidEm.toISOString(),
    }));

  // Cachês a receber do contratante (só admin precisa)
  let contratanteItems: ContratanteItem[] = [];
  if (admin) {
    const pendingFromContratante = await db.query.shows.findMany({
      where: and(eq(shows.status, "concluido"), ne(shows.pagamentoStatus, "pago")),
      with: { casa: { columns: { nome: true } } },
      orderBy: (s, { asc }) => [asc(s.data)],
    });
    contratanteItems = pendingFromContratante.map((s) => ({
      showId: s.id,
      showLabel: s.casa.nome,
      showData: s.data.toISOString(),
      valorCentavos: s.cacheCentavos ?? 0,
      pagamentoStatus: s.pagamentoStatus,
    }));
  }

  // Relatório executivo do ano corrente (admin).
  let report: FinanceReportData | null = null;
  if (admin) {
    const year = new Date().getFullYear();
    let grossYTD = 0;
    let managerYTD = 0;
    const perMemberYTD = new Map<string, number>();
    const venueAgg = new Map<string, { sum: number; count: number }>();
    for (const s of payableShows) {
      const va = venueAgg.get(s.casa.nome) ?? { sum: 0, count: 0 };
      va.sum += s.cacheCentavos ?? 0;
      va.count++;
      venueAgg.set(s.casa.nome, va);
      if (s.data.getFullYear() !== year) continue;
      grossYTD += s.cacheCentavos ?? 0;
      const { confirmados, ovMap, participantes } = resolveShow(s);
      if (confirmados.length === 0) continue;
      const bd = computePaymentBreakdown({
        cacheCentavos: s.cacheCentavos ?? 0,
        applyCommission: s.applyCommission,
        commissionPct: s.commissionPct,
        confirmedMusicos: participantes,
        managerMember,
        overrides: ovMap,
      });
      managerYTD += bd.managerCentavos;
      for (const [mid, info] of bd.perMember) {
        if (!memberById.has(mid)) continue; // ignora subs (não são membros)
        perMemberYTD.set(mid, (perMemberYTD.get(mid) ?? 0) + info.valorCentavos);
      }
    }
    report = {
      year,
      grossYTD,
      managerYTD,
      topVenues: [...venueAgg.entries()]
        .map(([nome, v]) => ({ nome, avg: Math.round(v.sum / v.count), count: v.count }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3),
      perMember: [...perMemberYTD.entries()]
        .map(([mid, total]) => ({ nome: memberById.get(mid)?.nome ?? "—", total }))
        .sort((a, b) => b.total - a.total),
    };
  }

  const isEmpty =
    cacheItems.length === 0 &&
    reembolsoItems.length === 0 &&
    contratanteItems.length === 0;

  return (
    <div>
      <PageHeader
        title="Cachês"
        description={
          admin
            ? "Cachês a pagar aos músicos, cachês a receber do contratante e reembolsos. Comprovante PIX obrigatório em todos."
            : "Seus cachês e reembolsos. Confirme o recebimento quando o admin marcar um pagamento."
        }
        actions={
          <div className="flex items-center gap-2">
            {admin && (
              <Button size="sm" render={<Link href="/pagamentos/novo" />}>
                <Plus className="size-4" /> Novo reembolso
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {report && report.grossYTD > 0 && <FinanceReport data={report} />}
        {isEmpty ? (
          <Card>
            <EmptyState
              icon={Wallet}
              title="Tudo em dia"
              description={
                admin
                  ? "Não há cachês ou reembolsos pendentes. Quando um show com músicos confirmados acontecer, eles aparecem aqui pra pagar."
                  : "Não há pagamentos pendentes pra você no momento."
              }
            />
          </Card>
        ) : (
          <PagamentosHub
            cacheItems={cacheItems}
            reembolsoItems={reembolsoItems}
            contratanteItems={contratanteItems}
            admin={admin}
            currentMemberId={meMemberId}
          />
        )}
      </div>
    </div>
  );
}
