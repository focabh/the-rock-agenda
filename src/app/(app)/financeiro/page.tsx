import { redirect } from "next/navigation";
import { TrendingUp, Clock, Send, PiggyBank, Trophy, Wallet } from "lucide-react";
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
  const membroId = membroParam ?? "";

  const distrib: DonutSeg[] = r.perMember.map((m, i) => ({
    label: m.nome,
    value: m.devido,
    color: PALETTE[i % PALETTE.length],
  }));
  if (r.managerTotal > 0) {
    const mgr = r.membros.find((m) => !r.perMember.some((p) => p.id === m.id));
    distrib.push({ label: `${mgr?.nome ?? "Manager"} (comissão)`, value: r.managerTotal, color: "#f59e0b" });
  }

  const maxVenue = Math.max(1, ...r.topVenues.map((v) => v.total));
  const foco = membroId ? r.perMember.find((m) => m.id === membroId) : null;
  const semDados = r.faturado === 0 && r.gastosTotal === 0;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="O caixa da banda sem buracos: o que faturou, o que entrou, o que ainda deve aos músicos e pra onde foi."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <FinanceFilters anos={r.anos} ano={r.ano} membros={r.membros} membroId={membroId} />
            <FinanceExport ano={r.ano} />
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">Controle financeiro — {r.ano}</h1>
        </div>
        {semDados ? (
          <Card>
            <EmptyState icon={Wallet} title={`Sem movimento em ${r.ano}`} description="Quando houver shows concluídos com cachê ou gastos no ano, o relatório aparece aqui." />
          </Card>
        ) : (
          <>
            {/* KPIs de caixa */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi icon={<TrendingUp className="size-4" />} label="Recebido (entrou no caixa)" value={formatBRL(r.recebido)} accent />
              <Kpi icon={<Clock className="size-4" />} label="A receber (contratante)" value={formatBRL(r.aReceberContratante)} />
              <Kpi icon={<Send className="size-4" />} label="A repassar (músicos)" value={formatBRL(r.aRepassarMusicos)} danger={r.aRepassarMusicos > 0} />
              <Kpi icon={<PiggyBank className="size-4" />} label="Saldo em caixa" value={formatBRL(r.saldoCaixa)} accent={r.saldoCaixa >= 0} danger={r.saldoCaixa < 0} />
            </div>

            {/* Linha secundária */}
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Mini label="Faturado (concluídos)" value={formatBRL(r.faturado)} />
              <Mini label="Repassado aos músicos" value={formatBRL(r.repassadoMusicos)} />
              <Mini label="Gastos + reembolsos" value={formatBRL(r.gastosTotal + r.reembolsosTotal)} />
              <Mini label="Comissão do manager" value={formatBRL(r.managerTotal)} />
            </div>

            {foco && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4 text-sm">
                  <span className="font-medium text-zinc-100">{foco.nome}</span> em {r.ano}: devido{" "}
                  <span className="font-mono text-amber-400">{formatBRL(foco.devido)}</span> em{" "}
                  <span className="font-mono">{foco.shows}</span> show(s) · já recebeu{" "}
                  <span className="font-mono text-emerald-400">{formatBRL(foco.repassado)}</span> · falta receber{" "}
                  <span className="font-mono text-red-400">{formatBRL(foco.aReceber)}</span>.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5">
                  <p className="mb-4 text-xs uppercase tracking-wider text-zinc-400">Distribuição (devido) — quem recebe</p>
                  {distrib.length ? <DonutChart segments={distrib} centerTop="Devido total" /> : <p className="text-sm text-zinc-400">Sem músicos confirmados.</p>}
                </CardContent>
              </Card>
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5">
                  <p className="mb-4 text-xs uppercase tracking-wider text-zinc-400">Entradas (recebidas) × Saídas por mês</p>
                  <MonthlyBars months={r.months} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5">
                  <p className="mb-4 flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
                    <Trophy className="size-3.5" /> Casas por faturamento
                  </p>
                  {r.topVenues.length === 0 ? (
                    <p className="text-sm text-zinc-400">—</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {r.topVenues.slice(0, 5).map((v) => (
                        <li key={v.nome} className="text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-zinc-100">{v.nome}</span>
                            <span className="font-mono text-amber-400 shrink-0">{formatBRL(v.total)}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${(v.total / maxVenue) * 100}%` }} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-zinc-500">{v.count} show(s) · média {formatBRL(v.avg)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Por músico — devido / recebido / a receber */}
              <Card className="border-zinc-800 bg-[#18181b]">
                <CardContent className="py-5">
                  <p className="mb-3 text-xs uppercase tracking-wider text-zinc-400">Por músico em {r.ano}</p>
                  {r.perMember.length === 0 ? (
                    <p className="text-sm text-zinc-400">—</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                            <th className="py-1 text-left font-medium">Músico</th>
                            <th className="py-1 text-right font-medium">Devido</th>
                            <th className="py-1 text-right font-medium">Recebido</th>
                            <th className="py-1 text-right font-medium">A receber</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {r.perMember
                            .filter((m) => !membroId || m.id === membroId)
                            .map((m) => (
                              <tr key={m.id}>
                                <td className="py-1.5 text-zinc-100">
                                  {m.nome} <span className="text-zinc-500">· {m.shows}</span>
                                </td>
                                <td className="py-1.5 text-right font-mono text-zinc-300">{formatBRL(m.devido)}</td>
                                <td className="py-1.5 text-right font-mono text-emerald-400">{formatBRL(m.repassado)}</td>
                                <td className="py-1.5 text-right font-mono text-red-400">{formatBRL(m.aReceber)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-3 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
                    Gastos (shows {formatBRL(r.gastosShow)} · extras {formatBRL(r.gastosExtra)}) · reembolsos {formatBRL(r.reembolsosTotal)}.
                  </p>
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#18181b] px-3 py-2">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="font-mono text-zinc-100">{value}</p>
    </div>
  );
}
