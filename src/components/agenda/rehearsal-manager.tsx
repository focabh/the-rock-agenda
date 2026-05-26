"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDataBR } from "@/lib/formatters";
import { toast } from "sonner";
import {
  createRehearsalAction,
  updateRehearsalAction,
  deleteRehearsalAction,
} from "@/app/(app)/agenda/actions";
import type { Rehearsal } from "@/db/schema";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toDateInput(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<Rehearsal["status"], string> = {
  planejado: "Planejado",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

export function RehearsalForm({
  rehearsal,
  defaultDate,
  onDone,
}: {
  rehearsal?: Rehearsal;
  defaultDate?: Date;
  onDone: () => void;
}) {
  const action = rehearsal
    ? updateRehearsalAction.bind(null, rehearsal.id)
    : createRehearsalAction;
  const [state, formAction, pending] = useActionState(action, null);
  const todayStr = toDateInput(new Date());
  const initialDate = rehearsal
    ? toDateInput(rehearsal.data)
    : defaultDate
      ? toDateInput(defaultDate)
      : todayStr;

  return (
    <form
      action={(fd) => {
        formAction(fd);
        setTimeout(() => {
          if (!state?.error && !state?.fieldErrors) {
            toast.success(rehearsal ? "Ensaio atualizado." : "Ensaio criado.");
            onDone();
          }
        }, 300);
      }}
      className="border border-border rounded-md p-4 space-y-3 bg-muted/20"
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            name="data"
            type="date"
            defaultValue={initialDate}
            required
          />
          <FieldError state={state} name="data" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inicio">Início</Label>
          <Input
            id="inicio"
            name="inicio"
            type="time"
            defaultValue={rehearsal?.inicio ?? ""}
          />
          <FieldError state={state} name="inicio" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="termino">Término</Label>
          <Input
            id="termino"
            name="termino"
            type="time"
            defaultValue={rehearsal?.termino ?? ""}
          />
          <FieldError state={state} name="termino" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="local">Local</Label>
          <Input
            id="local"
            name="local"
            placeholder="Estúdio, casa do baterista..."
            defaultValue={rehearsal?.local ?? ""}
          />
          <FieldError state={state} name="local" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={rehearsal?.status ?? "planejado"}
            className={selectCls}
          >
            <option value="planejado">Planejado</option>
            <option value="confirmado">Confirmado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="foco">Foco do ensaio</Label>
        <Input
          id="foco"
          name="foco"
          placeholder="Músicas novas, repertório do show de sábado..."
          defaultValue={rehearsal?.foco ?? ""}
        />
        <FieldError state={state} name="foco" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          defaultValue={rehearsal?.observacoes ?? ""}
        />
        <FieldError state={state} name="observacoes" />
      </div>
      {state?.error && !state.fieldErrors && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : rehearsal ? "Salvar" : "Criar ensaio"}
        </Button>
      </div>
    </form>
  );
}

export function RehearsalManager({
  rehearsals,
}: {
  rehearsals: Rehearsal[];
}) {
  const [mode, setMode] = useState<
    { type: "none" } | { type: "create" } | { type: "edit"; r: Rehearsal }
  >({ type: "none" });
  const [, startTransition] = useTransition();

  const sorted = [...rehearsals].sort(
    (a, b) => a.data.getTime() - b.data.getTime()
  );

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <CalendarPlus className="size-4" />
              Ensaios do mês
            </h3>
            <p className="text-sm text-muted-foreground">
              Os ensaios aparecem no calendário marcados como{" "}
              <span className="text-emerald-400 font-medium">Ensaio</span>.
            </p>
          </div>
          {mode.type === "none" && (
            <Button onClick={() => setMode({ type: "create" })}>
              <Plus className="size-4" />
              Novo ensaio
            </Button>
          )}
        </div>

        {mode.type === "create" && (
          <RehearsalForm onDone={() => setMode({ type: "none" })} />
        )}

        {sorted.length === 0 && mode.type === "none" ? (
          <EmptyState
            icon={CalendarPlus}
            title="Nenhum ensaio neste mês"
            description="Crie um ensaio para organizar a banda — ele aparece no calendário acima."
          />
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {sorted.map((r) =>
              mode.type === "edit" && mode.r.id === r.id ? (
                <li key={r.id} className="p-3">
                  <RehearsalForm
                    rehearsal={r}
                    onDone={() => setMode({ type: "none" })}
                  />
                </li>
              ) : (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {formatDataBR(r.data)}
                      {r.inicio && (
                        <span className="font-mono text-muted-foreground ml-2">
                          {r.inicio}
                          {r.termino ? `–${r.termino}` : ""}
                        </span>
                      )}
                      <span
                        className={
                          "ml-2 text-xs uppercase tracking-wider " +
                          (r.status === "cancelado"
                            ? "text-muted-foreground"
                            : r.status === "confirmado"
                              ? "text-emerald-400"
                              : "text-amber-400")
                        }
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </p>
                    {(r.local || r.foco) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[r.local, r.foco].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Editar"
                    onClick={() => setMode({ type: "edit", r })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    title="Remover"
                    onClick={() => {
                      if (!confirm("Remover este ensaio?")) return;
                      startTransition(async () => {
                        await deleteRehearsalAction(r.id);
                        toast.success("Ensaio removido.");
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              )
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
