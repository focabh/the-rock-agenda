"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Loader2, Trash2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TIPO_LABEL, TIPOS, DICIONARIO } from "@/lib/equipamentos";
import {
  createEquipamentoAction,
  deleteEquipamentoAction,
} from "@/app/(app)/equipamentos/actions";

export type EquipItem = {
  id: string;
  nome: string;
  categoria: "individual" | "infraestrutura_coletiva";
  tipo: string;
  proprietarioId: string | null;
  proprietarioNome: string | null;
  especificacoes: string | null;
};

const selectCls =
  "h-10 w-full rounded-md border border-zinc-700 bg-[#18181b] px-3 text-sm text-zinc-100";

export function EquipamentosManager({
  itens,
  membros,
  canEdit,
}: {
  itens: EquipItem[];
  membros: { id: string; nome: string }[];
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [filtro, setFiltro] = useState<"todos" | "banda" | "musicos">("todos");
  const [tipoFiltro, setTipoFiltro] = useState("");

  // form manual
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<"individual" | "infraestrutura_coletiva">("infraestrutura_coletiva");
  const [tipo, setTipo] = useState("mesa_som");
  const [dono, setDono] = useState("");
  const [specs, setSpecs] = useState("");

  const filtrados = useMemo(
    () =>
      itens.filter((e) => {
        if (filtro === "banda" && e.categoria !== "infraestrutura_coletiva") return false;
        if (filtro === "musicos" && e.categoria !== "individual") return false;
        if (tipoFiltro && e.tipo !== tipoFiltro) return false;
        return true;
      }),
    [itens, filtro, tipoFiltro]
  );

  function add(data: Parameters<typeof createEquipamentoAction>[0]) {
    start(async () => {
      const r = await createEquipamentoAction(data);
      if (r.ok) toast.success("Equipamento adicionado.");
      else toast.error(r.error ?? "Erro.");
    });
  }
  function addManual() {
    if (!nome.trim()) return;
    add({ nome, categoria, tipo, proprietarioId: dono || null, especificacoes: specs });
    setNome("");
    setSpecs("");
    setDono("");
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card className="border-zinc-800 bg-[#18181b]">
          <CardContent className="py-5 space-y-4">
            {/* Dicionário — 1 clique */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
                <Zap className="size-3.5 text-amber-400" /> Adicionar rápido
              </p>
              <div className="flex flex-wrap gap-2">
                {DICIONARIO.map((d) => (
                  <button
                    key={d.nome}
                    disabled={pending}
                    onClick={() =>
                      add({ nome: d.nome, categoria: d.categoria, tipo: d.tipo, proprietarioId: null, especificacoes: null })
                    }
                    className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    + {d.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual */}
            <div className="grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="eq-nome">Equipamento</Label>
                <Input id="eq-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Fone Retorno Shure PSM300" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq-cat">Categoria</Label>
                <select id="eq-cat" value={categoria} onChange={(e) => setCategoria(e.target.value as typeof categoria)} className={selectCls}>
                  <option value="infraestrutura_coletiva">Da banda (coletivo)</option>
                  <option value="individual">De um músico</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq-tipo">Tipo</Label>
                <select id="eq-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls}>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              {categoria === "individual" && (
                <div className="space-y-1.5">
                  <Label htmlFor="eq-dono">Dono</Label>
                  <select id="eq-dono" value={dono} onChange={(e) => setDono(e.target.value)} className={selectCls}>
                    <option value="">—</option>
                    {membros.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="eq-specs">Especificações (opcional)</Label>
                <Input id="eq-specs" value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="Ex.: 18 canais, 2 aux" />
              </div>
              <div className="flex items-end sm:col-span-2">
                <Button onClick={addManual} disabled={pending || !nome.trim()} className="ml-auto">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
        {([["todos", "Todos"], ["banda", "Da banda"], ["musicos", "Dos músicos"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
              filtro === k ? "border-primary bg-primary/20 text-primary" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            )}
          >
            {l}
          </button>
        ))}
        <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="shrink-0 h-9 rounded-full border border-zinc-700 bg-[#18181b] px-3 text-sm text-zinc-100">
          <option value="">Todos os tipos</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>{TIPO_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <Card className="border-zinc-800 bg-[#18181b]">
          <CardContent className="py-10 text-center text-sm text-zinc-400">
            Nenhum equipamento com esses filtros.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-zinc-800 bg-[#18181b] p-0 overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {filtrados.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-100 truncate">{e.nome}</p>
                  <p className="text-xs text-zinc-500">
                    {TIPO_LABEL[e.tipo]} ·{" "}
                    {e.categoria === "individual"
                      ? e.proprietarioNome ?? "de um músico"
                      : "da banda"}
                    {e.especificacoes && ` · ${e.especificacoes}`}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-500 hover:text-destructive"
                    title="Remover"
                    onClick={() =>
                      start(async () => {
                        await deleteEquipamentoAction(e.id);
                        toast.success("Removido.");
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
