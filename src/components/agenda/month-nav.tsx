"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthNav({ year, month }: { year: number; month: number }) {
  const cur = new Date(year, month, 1);
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        render={<Link href={`/agenda?m=${ymKey(prev)}`} />}
        title="Mês anterior"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <h2 className="text-base font-semibold min-w-[180px] text-center">
        {MESES[cur.getMonth()]} {cur.getFullYear()}
      </h2>
      <Button
        variant="outline"
        size="icon"
        render={<Link href={`/agenda?m=${ymKey(next)}`} />}
        title="Próximo mês"
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/agenda" />}
      >
        <Calendar className="size-4" />
        Hoje
      </Button>
    </div>
  );
}
