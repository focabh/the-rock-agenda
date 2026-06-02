"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, RotateCcw, Send, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setVenuePipelineStageAction } from "@/app/(app)/casas/actions";

export type Stage = "novo" | "material" | "aguardando" | "negociando" | "fechado" | "descartado";
export type FunilCard = {
  id: string;
  nome: string;
  cidade: string;
  contato: string | null;
  materialEnviadoEm: number | null;
  ultimoContatoEm: number | null;
  stage: Stage;
};

// Fluxo principal (ordem do funil). "descartado" fica fora do fluxo.
const FLOW: Stage[] = ["novo", "material", "aguardando", "negociando", "fechado"];
const LABEL: Record<Stage, string> = {
  novo: "Novo contato",
  material: "Material enviado",
  aguardando: "Aguardando resposta",
  negociando: "Negociando data",
  fechado: "Fechado",
  descartado: "Descartado",
};
const COL_ACCENT: Record<Stage, string> = {
  novo: "border-t-zinc-400",
  material: "border-t-sky-400",
  aguardando: "border-t-amber-400",
  negociando: "border-t-violet-400",
  fechado: "border-t-emerald-400",
  descartado: "border-t-zinc-600",
};

function fmtDate(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function FunilBoard({ cards: initial }: { cards: FunilCard[] }) {
  const [cards, setCards] = useState<FunilCard[]>(initial);
  const [, start] = useTransition();

  const temDescartado = useMemo(() => cards.some((c) => c.stage === "descartado"), [cards]);
  const columns: Stage[] = temDescartado ? [...FLOW, "descartado"] : FLOW;

  function move(id: string, stage: Stage) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
    start(async () => {
      await setVenuePipelineStageAction(id, stage);
    });
  }

  function shift(card: FunilCard, dir: -1 | 1) {
    const i = FLOW.indexOf(card.stage);
    if (i < 0) {
      // estava descartado → volta pro fluxo
      move(card.id, "novo");
      return;
    }
    const next = FLOW[Math.min(FLOW.length - 1, Math.max(0, i + dir))];
    if (next !== card.stage) move(card.id, next);
  }

  if (cards.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma casa no funil ainda. Marque casas como <strong>“quero tocar”</strong> ou
        envie material em <Link href="/casas" className="text-primary underline">Casas</Link> que elas aparecem aqui.
      </Card>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {columns.map((col) => {
        const list = cards.filter((c) => c.stage === col);
        return (
          <div key={col} className="w-72 shrink-0">
            <div className={cn("mb-2 flex items-center justify-between rounded-lg border-t-2 bg-muted/40 px-3 py-2", COL_ACCENT[col])}>
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{LABEL[col]}</span>
              <span className="text-[11px] text-muted-foreground">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.map((c) => {
                const i = FLOW.indexOf(c.stage);
                const isDesc = c.stage === "descartado";
                const mat = fmtDate(c.materialEnviadoEm);
                const ult = fmtDate(c.ultimoContatoEm);
                return (
                  <Card key={c.id} className="space-y-2 p-3 transition-all hover:ring-primary/40">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/casas/${c.id}`} className="min-w-0 flex-1 hover:underline">
                        <p className="truncate text-sm font-semibold">{c.nome}</p>
                        {c.cidade && <p className="truncate text-xs text-muted-foreground">{c.cidade}</p>}
                      </Link>
                      {!isDesc && (
                        <button
                          onClick={() => move(c.id, "descartado")}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          title="Descartar"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {(c.contato || mat || ult) && (
                      <div className="space-y-0.5 text-[11px] text-muted-foreground">
                        {c.contato && <p className="truncate">{c.contato}</p>}
                        <div className="flex flex-wrap gap-x-3">
                          {mat && <span className="inline-flex items-center gap-1"><Send className="size-3" /> {mat}</span>}
                          {ult && <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {ult}</span>}
                        </div>
                      </div>
                    )}

                    {isDesc ? (
                      <button
                        onClick={() => move(c.id, "novo")}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="size-3.5" /> Restaurar
                      </button>
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => shift(c, -1)}
                          disabled={i <= 0}
                          className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                          title="Voltar etapa"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{LABEL[c.stage]}</span>
                        <button
                          onClick={() => shift(c, 1)}
                          disabled={i >= FLOW.length - 1}
                          className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                          title="Avançar etapa"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
              {list.length === 0 && (
                <p className="px-2 py-4 text-center text-[11px] text-muted-foreground/60">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
