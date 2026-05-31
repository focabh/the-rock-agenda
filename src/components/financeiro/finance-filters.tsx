"use client";

import { useRouter, useSearchParams } from "next/navigation";

const selectCls =
  "h-10 rounded-md border border-zinc-700 bg-[#18181b] px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FinanceFilters({
  anos,
  ano,
  membros,
  membroId,
}: {
  anos: number[];
  ano: number;
  membros: { id: string; nome: string }[];
  membroId: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/financeiro?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={String(ano)}
        onChange={(e) => setParam("ano", e.target.value)}
        className={selectCls}
        aria-label="Ano"
      >
        {anos.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        value={membroId}
        onChange={(e) => setParam("membro", e.target.value)}
        className={selectCls}
        aria-label="Músico"
      >
        <option value="">Toda a banda</option>
        {membros.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
