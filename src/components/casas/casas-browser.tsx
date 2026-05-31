"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Phone, ChevronRight, Search } from "lucide-react";
import { formatRelativeBR } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteButton } from "@/components/shared/delete-button";
import { deleteCasaAction } from "@/app/(app)/casas/actions";

export type CasaItem = {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  contatoPrincipal: string | null;
  telefone: string | null;
  observacoes: string | null;
  querTocar: boolean;
  jaTocou: boolean; // efetivo (flag OU tem show passado)
  naoContatar: boolean;
  ultimoContatoEmISO: string | null;
};

type StatusFilter = "todos" | "jaTocou" | "querTocar";

const inputCls =
  "h-10 w-full rounded-md border border-zinc-700 bg-[#18181b] px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CasasBrowser({
  casas,
  admin,
}: {
  casas: CasaItem[];
  admin: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");

  const cidades = useMemo(
    () =>
      [...new Set(casas.map((c) => (c.cidade ?? "").trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
    [casas]
  );

  // Bairros da cidade selecionada (ou de todas, se nenhuma cidade escolhida).
  const bairros = useMemo(
    () =>
      [
        ...new Set(
          casas
            .filter((c) => !cidade || (c.cidade ?? "").trim() === cidade)
            .map((c) => (c.bairro ?? "").trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [casas, cidade]
  );

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return casas.filter((c) => {
      if (status === "jaTocou" && !c.jaTocou) return false;
      if (status === "querTocar" && !c.querTocar) return false;
      if (cidade && (c.cidade ?? "").trim() !== cidade) return false;
      if (bairro && (c.bairro ?? "").trim() !== bairro) return false;
      if (t) {
        const hay = `${c.nome} ${c.contatoPrincipal ?? ""} ${c.bairro ?? ""} ${c.cidade ?? ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [casas, q, status, cidade, bairro]);

  const STATUS: { key: StatusFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "jaTocou", label: "Já tocamos" },
    { key: "querTocar", label: "Quero tocar" },
  ];

  return (
    <div className="space-y-4">
      {/* Barra de filtros (rolagem horizontal no mobile) */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, contato ou bairro…"
            className={cn(inputCls, "pl-9")}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
          {STATUS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                status === s.key
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              )}
            >
              {s.label}
            </button>
          ))}
          {cidades.length > 1 && (
            <select
              value={cidade}
              onChange={(e) => {
                setCidade(e.target.value);
                setBairro(""); // bairro depende da cidade
              }}
              className="shrink-0 h-9 rounded-full border border-zinc-700 bg-[#18181b] px-3 text-sm text-zinc-100"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {bairros.length > 1 && (
            <select
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="shrink-0 h-9 rounded-full border border-zinc-700 bg-[#18181b] px-3 text-sm text-zinc-100"
            >
              <option value="">
                {cidade ? `Todo(a) ${cidade}` : "Todos os bairros"}
              </option>
              {bairros.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <span className="shrink-0 ml-auto pl-2 text-sm text-zinc-400">
            <span className="font-mono text-amber-400">{filtradas.length}</span>{" "}
            casa(s)
          </span>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <Card className="border-zinc-800 bg-[#18181b]">
          <CardContent className="py-10 text-center text-sm text-zinc-400">
            Nenhuma casa encontrada com esses filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((c) => (
            <Card
              key={c.id}
              className="flex flex-col overflow-hidden border-zinc-800 bg-[#18181b] p-0 transition-colors hover:border-primary/40"
            >
              <Link href={`/casas/${c.id}`} className="block flex-1 hover:bg-accent/30">
                <CardContent className="py-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate text-zinc-100">
                        {c.nome}
                      </h3>
                      {(c.bairro || c.cidade) && (
                        <p className="text-sm text-zinc-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="size-3.5" />
                          {[c.bairro, c.cidade].filter(Boolean).join(" • ")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-4 text-zinc-500 shrink-0" />
                  </div>

                  {(c.querTocar || c.jaTocou || c.naoContatar) && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.naoContatar && (
                        <Tag className="bg-red-500/15 text-red-300 ring-red-500/30">
                          Não contatar
                        </Tag>
                      )}
                      {c.querTocar && (
                        <Tag className="bg-primary/20 text-primary ring-primary/40">
                          Quer tocar
                        </Tag>
                      )}
                      {c.jaTocou && (
                        <Tag className="bg-emerald-500/15 text-emerald-300 ring-emerald-500/30">
                          Já tocou
                        </Tag>
                      )}
                    </div>
                  )}

                  {c.contatoPrincipal && (
                    <p className="text-sm text-zinc-300">
                      <span className="text-zinc-400">Contato:</span>{" "}
                      {c.contatoPrincipal}
                    </p>
                  )}
                  {c.telefone && (
                    <p className="text-sm text-zinc-400 flex items-center gap-1">
                      <Phone className="size-3.5" />
                      {c.telefone}
                    </p>
                  )}
                  {c.observacoes && (
                    <p className="text-sm text-zinc-400 line-clamp-2">
                      {c.observacoes}
                    </p>
                  )}
                  {c.ultimoContatoEmISO && (
                    <p className="text-xs text-zinc-500">
                      Último contato:{" "}
                      {formatRelativeBR(new Date(c.ultimoContatoEmISO))}
                    </p>
                  )}
                </CardContent>
              </Link>
              {admin && (
                <div className="flex items-center justify-end border-t border-zinc-800 px-3 py-2">
                  <DeleteButton
                    itemName={c.nome}
                    action={deleteCasaAction.bind(null, c.id)}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        className
      )}
    >
      {children}
    </span>
  );
}
