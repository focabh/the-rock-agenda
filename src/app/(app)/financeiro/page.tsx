import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Wallet, Clock, Trophy } from "lucide-react";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { loadFinanceReport } from "@/lib/finance-report";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatBRL } from "@/lib/formatters";
import { FinanceFilters } from "@/components/financeiro/finance-filters";
import { FinanceExport } from "@/components/financeiro/finance-export";
import { DonutChart, type DonutSeg } from "@/components/financeiro/donut-chart";
import { MonthlyBars } from "@/components/financeiro/monthly-bars";

const PALETTE = ["#38bdf8","#a78bfa","#34d399","#f472b6","#fb923c","#22d3ee","#c084fc","#a3e635"];

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; membro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/pagamentos");
  const { ano: anoParam, membro: membroParam } = await searchParams;

  const r = await loadFinanceReport(anoParam);
  const { ano, anos, entradas, gastosTotal, gastosShow, gastosExtra, reembolsosTotal, managerTotal, liquido, aReceber, perMember, topVenues, months, membros } = r;
  const membroId = membroParam ?? "";

  const distrib: DonutSeg[] = perMember.map((m, i) => ({
    label: m.nome,
    value: m.total,
    color: PALETTE[i % PALETTE.length],
  }));
  if (managerTotal > 0) {
    const mgr = membros.find((m) => !perMember.some((p) => p.id === m.id));
    distrib.push({ label: `${mgr?.nome ?? "Manager"} (comissão)`, value: managerTotal, color: "#f59e0b" });
  }

  const maxVenue = Math.max(1, ...topVenues.map((v) => v.total));
  const foco = membroId ? perMember.find((m) => m.id === membroId) : null;
  const semDados = entradas === 0 && gastosTotal === 0;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="A saúde financeira da banda como empresa: o que entra, o que sai e pra quem vai."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <FinanceFilters anos={anos} ano={ano} membros={membros} membroId={membroId} />
            <FinanceExport ano={ano} />
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">Relatório financeiro — {ano}</h1>
        </div>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi icon={<TrendingUp className="size-4" />} label="Entradas (cachês)" value={formatBRL(entradas)} accent />
              <Kpi icon={<TrendingDown className="size-4" />} label="Gastos da banda" value={formatBRL(gastosTotal)} />
              <Kpi icon={<Wallet className="size-4" />} label="Líquido (entra − gasta)" value={formatBRL(liquido)} accent={liquido >= 0} danger={liquido < 0} />
              <Kpi icon={<Clock className="size-4" />} label="A receber" value={formatBRL(aReceber)} />
            </div>

            {foco && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4 text-sm">
                  <span className="font-medium text-zinc-100">{foco.nome}</span> em {ano}: recebeu{" "}
                  <span className="font-mono text-amber-400">{formatBRL(foco.total)}</span> em{" "}
                  <span className="font-mono">{foco.shows}</span> show(s) — média{" "}
                  <span className="font-mono">{formatBRL(foco.shows ? Math.round(foco.total / foco.shows) : 0)}</span>/show.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
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
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5">
                  <p className="mb-4 flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
                    <Trophy className="size-3.5" /> Casas por faturamento
                  </p>
                  {topVenues.length === 0 ? (
                    <p className="text-sm text-zinc-400">—</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {topVenues.slice(0, 5).map((v) => (
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

              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5 space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wider text-zinc-400">Pago por músico em {ano}</p>
                    {perMember.length === 0 ? (
                      <p className="text-sm text-zinc-400">—</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {perMember
                          .filter((m) => !membroId || m.id === membroId)
                          .map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-2">
                              <span className="truncate text-zinc-100">
                                {m.nome} <span className="text-zinc-500">· {m.shows} show(s)</span>
                              </span>
                              <span className="font-mono text-amber-400 shrink-0">{formatBRL(m.total)}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div className="border-t border-zinc-800 pt-3 text-sm space-y-1">
                    <p className="flex items-center justify-between text-zinc-400"><span>Gastos (shows)</span><span className="font-mono text-zinc-300">{formatBRL(gastosShow)}</span></p>
                    <p className="flex items-center justify-between text-zinc-400"><span>Gastos (extras)</span><span className="font-mono text-zinc-300">{formatBRL(gastosExtra)}</span></p>
                    <p className="flex items-center justify-between text-zinc-400"><span>Reembolsos</span><span className="font-mono text-zinc-300">{formatBRL(reembolsosTotal)}</span></p>
                    <p className="flex items-center justify-between font-medium pt-1"><span>Comissão do manager</span><span className="font-mono text-amber-400">{formatBRL(managerTotal)}</span></p>
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

function Kpi({ icon, label, value, accent = false, danger = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <Card className="border-zinc-800 bg-[#18181b]">
      <CardContent className="py-4">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400">{icon} {label}</p>
        <p className={"mt-1 font-mono text-2xl font-semibold " + (danger ? "text-red-400" : accent ? "text-amber-400" : "text-zinc-100")}>{value}</p>
      </CardContent>
    </Card>
  );
}
