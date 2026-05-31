import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { loadFinanceReport } from "@/lib/finance-report";

const brl = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({}, { status: 403 });

  const ano = req.nextUrl.searchParams.get("ano") ?? undefined;
  const r = await loadFinanceReport(ano);

  const lines: string[] = [];
  lines.push(`Relatório financeiro;${r.ano}`);
  lines.push("");
  lines.push("Indicador;Valor (R$)");
  lines.push(`Entradas (cachês);${brl(r.entradas)}`);
  lines.push(`Gastos da banda;${brl(r.gastosTotal)}`);
  lines.push(`  Gastos (shows);${brl(r.gastosShow)}`);
  lines.push(`  Gastos (extras);${brl(r.gastosExtra)}`);
  lines.push(`Reembolsos;${brl(r.reembolsosTotal)}`);
  lines.push(`Comissão do manager;${brl(r.managerTotal)}`);
  lines.push(`Líquido (entra - gasta);${brl(r.liquido)}`);
  lines.push(`A receber;${brl(r.aReceber)}`);
  lines.push("");
  lines.push("Pago por músico;Shows;Total (R$)");
  for (const m of r.perMember) lines.push(`${m.nome};${m.shows};${brl(m.total)}`);
  lines.push("");
  lines.push("Casa;Shows;Faturamento (R$);Cachê médio (R$)");
  for (const v of r.topVenues) lines.push(`${v.nome};${v.count};${brl(v.total)};${brl(v.avg)}`);
  lines.push("");
  lines.push("Mês;Entradas (R$);Saídas (R$)");
  for (const m of r.months) lines.push(`${m.label};${brl(m.entradas)};${brl(m.saidas)}`);

  // BOM pra abrir certinho no Excel (acentos).
  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${r.ano}.csv"`,
    },
  });
}
