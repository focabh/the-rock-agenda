import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Trophy, Users } from "lucide-react";
import { formatBRL } from "@/lib/formatters";

export type FinanceReportData = {
  year: number;
  grossYTD: number;
  managerYTD: number;
  topVenues: { nome: string; avg: number; count: number }[];
  perMember: { nome: string; total: number }[];
};

/** Relatório executivo do ano corrente (admin) — topo da tela de Cachês. */
export function FinanceReport({ data }: { data: FinanceReportData }) {
  return (
    <Card className="border-zinc-800 bg-[#18181b]">
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wider text-zinc-400 mb-4">
          Relatório {data.year}
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          {/* Faturamento bruto */}
          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400">
              <TrendingUp className="size-3.5" /> Faturamento bruto
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-amber-400">
              {formatBRL(data.grossYTD)}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Comissão do manager:{" "}
              <span className="font-mono text-zinc-100">
                {formatBRL(data.managerYTD)}
              </span>
            </p>
          </div>

          {/* Top 3 casas por cachê médio */}
          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400">
              <Trophy className="size-3.5" /> Top casas (cachê médio)
            </p>
            {data.topVenues.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-400">—</p>
            ) : (
              <ol className="mt-1.5 space-y-1 text-sm">
                {data.topVenues.map((v, i) => (
                  <li key={v.nome} className="flex items-center justify-between gap-2">
                    <span className="truncate text-zinc-100">
                      {i + 1}. {v.nome}
                    </span>
                    <span className="font-mono text-amber-400 shrink-0">
                      {formatBRL(v.avg)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Por músico no ano */}
          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400">
              <Users className="size-3.5" /> Pago por músico (ano)
            </p>
            {data.perMember.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-400">—</p>
            ) : (
              <ol className="mt-1.5 space-y-1 text-sm">
                {data.perMember.map((m) => (
                  <li key={m.nome} className="flex items-center justify-between gap-2">
                    <span className="truncate text-zinc-100">{m.nome}</span>
                    <span className="font-mono text-amber-400 shrink-0">
                      {formatBRL(m.total)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
