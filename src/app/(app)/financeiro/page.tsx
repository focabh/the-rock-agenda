import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { TrendingUp, TrendingDown, Wallet, Clock, Trophy } from "lucide-react";
import { db } from "@/db";
import {
  shows,
  members,
  showMemberPresence,
  showMemberPayment,
  gastos,
  reembolsos,
} from "@/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatBRL } from "@/lib/formatters";
import { computePaymentBreakdown } from "@/lib/payment";
import { FinanceFilters } from "@/components/financeiro/finance-filters";
import { DonutChart, type DonutSeg } from "@/components/financeiro/donut-chart";
import { MonthlyBars, type MonthPoint } from "@/components/financeiro/monthly-bars";

const MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const PALETTE = ["#38bdf8","#a78bfa","#34d399","#f472b6","#fb923c","#22d3ee","#c084fc","#a3e635"];

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; membro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/pagamentos");
  const { ano: anoParam, membro: membroParam } = await searchParams;

  const allMembers = await db.select().from(members);
  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  const managerMember = allMembers.find((m) => m.isManager) ?? null;
  const playable = allMembers.filter((m) => !m.isManager && m.ativo);

  const allShows = await db.query.shows.findMany({
    with: { casa: { columns: { nome: true } } },
  });

  // Anos disponíveis (dos shows + ano atual).
  const anosSet = new Set<number>([new Date().getFullYear()]);
  for (const s of allShows) anosSet.add(s.data.getFullYear());
  const anos = [...anosSet].sort((a, b) => b - a);
  const ano = anoParam && anos.includes(Number(anoParam)) ? Number(anoParam) : anos[0];
  const membroId = membroParam ?? "";

  // Shows do ano com cachê (realizados = concluído).
  const showsAno = allShows.filter((s) => s.data.getFullYear() === ano);
  const realizados = showsAno.filter(
    (s) => s.status === "concluido" && (s.cacheCentavos ?? 0) > 0
  );
  const realizadosIds = realizados.map((s) => s.id);

  const [presences, overrides, gastoRows, reembolsoRows] = await Promise.all([
    realizadosIds.length
      ? db.select().from(showMemberPresence).where(inArray(showMemberPresence.showId, realizadosIds))
      : Promise.resolve([] as (typeof showMemberPresence.$inferSelect)[]),
    realizadosIds.length
      ? db.select().from(showMemberPayment).where(inArray(showMemberPayment.showId, realizadosIds))
      : Promise.resolve([] as (typeof showMemberPayment.$inferSelect)[]),
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

  // ---- Agregações ----
  let entradas = 0;
  let managerTotal = 0;
  const perMember = new Map<string, number>(); // músico → recebido
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

  // A receber (concluído mas contratante não pagou).
  const aReceber = showsAno
    .filter((s) => s.status === "concluido" && s.pagamentoStatus !== "pago")
    .reduce((t, s) => t + (s.cacheCentavos ?? 0), 0);

  // Gastos e reembolsos do ano.
  const gastosAno = gastoRows.filter((g) => g.paidEm.getFullYear() === ano);
  const gastosTotal = gastosAno.reduce((t, g) => t + g.valorCentavos, 0);
  const gastosShow = gastosAno.filter((g) => g.tipo === "show").reduce((t, g) => t + g.valorCentavos, 0);
  const gastosExtra = gastosTotal - gastosShow;
  const mesSaidas = Array(12).fill(0);
  for (const g of gastosAno) mesSaidas[g.paidEm.getMonth()] += g.valorCentavos;

  const reembolsosAno = reembolsoRows.filter((r) => r.paidEm.getFullYear() === ano);
  const reembolsosTotal = reembolsosAno.reduce((t, r) => t + r.valorCentavos, 0);
  for (const r of reembolsosAno) mesSaidas[r.paidEm.getMonth()] += r.valorCentavos;

  const liquido = entradas - gastosTotal;

  // Distribuição (donut): cada músico + manager.
  const perMemberSorted = [...perMember.entries()]
    .map(([mid, v]) => ({ id: mid, nome: memberById.get(mid)?.nome ?? "—", total: v, shows: perMemberShows.get(mid) ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const distrib: DonutSeg[] = perMemberSorted.map((m, i) => ({
    label: m.nome,
    value: m.total,
    color: PALETTE[i % PALETTE.length],
  }));
  if (managerTotal > 0)
    distrib.push({ label: `${managerMember?.nome ?? "Manager"} (comissão)`, value: managerTotal, color: "#f59e0b" });

  const months: MonthPoint[] = MES.map((label, i) => ({
    label,
    entradas: mesEntradas[i],
    saidas: mesSaidas[i],
  }));

  const topVenues = [...venueAgg.entries()]
    .map(([nome, v]) => ({ nome, avg: Math.round(v.sum / v.count), total: v.sum, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxVenue = Math.max(1, ...topVenues.map((v) => v.total));

  // Foco em um músico (se filtrado).
  const foco = membroId ? perMemberSorted.find((m) => m.id === membroId) : null;
  const focoReembolsos = membroId
    ? reembolsosAno.filter((r) => r.memberId === membroId).reduce((t, r) => t + r.valorCentavos, 0)
    : 0;

  const semDados = realizados.length === 0 && gastosAno.length === 0;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="A saúde financeira da banda como empresa: o que entra, o que sai e pra quem vai."
        actions={
          <FinanceFilters
            anos={anos}
            ano={ano}
            membros={allMembers.map((m) => ({ id: m.id, nome: m.nome }))}
            membroId={membroId}
          />
        }
      />

      <div className="p-6 space-y-6">
        {semDados ? (
          <Card>
            <EmptyState
              icon={Wallet}
              title={`Sem movimento em ${ano}`}
              description="Quando houver shows concluídos com cachê ou gastos no ano, o relatório aparece aqui."
            />
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi icon={<TrendingUp className="size-4" />} label="Entradas (cachês)" value={formatBRL(entradas)} accent />
              <Kpi icon={<TrendingDown className="size-4" />} label="Gastos da banda" value={formatBRL(gastosTotal)} />
              <Kpi icon={<Wallet className="size-4" />} label="Líquido (entra − gasta)" value={formatBRL(liquido)} accent={liquido >= 0} danger={liquido < 0} />
              <Kpi icon={<Clock className="size-4" />} label="A receber" value={formatBRL(aReceber)} />
            </div>

            {/* Foco no músico */}
            {foco && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4 text-sm">
                  <span className="font-medium text-zinc-100">{foco.nome}</span> em{" "}
                  {ano}: recebeu{" "}
                  <span className="font-mono text-amber-400">{formatBRL(foco.total)}</span>{" "}
                  em <span className="font-mono">{foco.shows}</span> show(s) — média{" "}
                  <span className="font-mono">{formatBRL(foco.shows ? Math.round(foco.total / foco.shows) : 0)}</span>
                  /show{focoReembolsos > 0 && <> · reembolsos <span className="font-mono text-amber-400">{formatBRL(focoReembolsos)}</span></>}.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Distribuição (quem recebe) */}
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5">
                  <p className="mb-4 text-xs uppercase tracking-wider text-zinc-400">
                    Distribuição dos cachês — quem recebe
                  </p>
                  {distrib.length ? (
                    <DonutChart segments={distrib} centerTop="Distribuído" />
                  ) : (
                    <p className="text-sm text-zinc-400">Sem músicos confirmados nos shows do ano.</p>
                  )}
                </CardContent>
              </Card>

              {/* Entradas x Saídas por mês */}
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5">
                  <p className="mb-4 text-xs uppercase tracking-wider text-zinc-400">
                    Entradas × Saídas por mês
                  </p>
                  <MonthlyBars months={months} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top casas por faturamento */}
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5">
                  <p className="mb-4 flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
                    <Trophy className="size-3.5" /> Casas por faturamento
                  </p>
                  {topVenues.length === 0 ? (
                    <p className="text-sm text-zinc-400">—</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {topVenues.map((v) => (
                        <li key={v.nome} className="text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-zinc-100">{v.nome}</span>
                            <span className="font-mono text-amber-400 shrink-0">{formatBRL(v.total)}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${(v.total / maxVenue) * 100}%` }} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {v.count} show(s) · média {formatBRL(v.avg)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Por músico + gastos */}
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5 space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wider text-zinc-400">
                      Pago por músico em {ano}
                    </p>
                    {perMemberSorted.length === 0 ? (
                      <p className="text-sm text-zinc-400">—</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {perMemberSorted
                          .filter((m) => !membroId || m.id === membroId)
                          .map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-2">
                              <span className="truncate text-zinc-100">
                                {m.nome}{" "}
                                <span className="text-zinc-500">· {m.shows} show(s)</span>
                              </span>
                              <span className="font-mono text-amber-400 shrink-0">{formatBRL(m.total)}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div className="border-t border-zinc-800 pt-3 text-sm space-y-1">
                    <p className="flex items-center justify-between text-zinc-400">
                      <span>Gastos (shows)</span>
                      <span className="font-mono text-zinc-300">{formatBRL(gastosShow)}</span>
                    </p>
                    <p className="flex items-center justify-between text-zinc-400">
                      <span>Gastos (extras)</span>
                      <span className="font-mono text-zinc-300">{formatBRL(gastosExtra)}</span>
                    </p>
                    <p className="flex items-center justify-between text-zinc-400">
                      <span>Reembolsos</span>
                      <span className="font-mono text-zinc-300">{formatBRL(reembolsosTotal)}</span>
                    </p>
                    <p className="flex items-center justify-between font-medium pt-1">
                      <span>Comissão do manager</span>
                      <span className="font-mono text-amber-400">{formatBRL(managerTotal)}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent = false,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <Card className="border-zinc-800 bg-[#18181b]">
      <CardContent className="py-4">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400">
          {icon} {label}
        </p>
        <p
          className={
            "mt-1 font-mono text-2xl font-semibold " +
            (danger ? "text-red-400" : accent ? "text-amber-400" : "text-zinc-100")
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
