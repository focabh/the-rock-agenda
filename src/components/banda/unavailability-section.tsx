"use client";

import {
  createUnavailabilityAction,
  deleteUnavailabilityAction,
} from "@/app/(app)/agenda/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MemberUnavailability } from "@/db/schema";
import { formatDataBR } from "@/lib/formatters";
import { CalendarOff, Plus, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

function toDateInput(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

export function UnavailabilitySection({
  memberId,
  blocks,
}: {
  memberId: string;
  blocks: MemberUnavailability[];
}) {
  const [state, formAction, pending] = useActionState(
    createUnavailabilityAction,
    null,
  );
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const todayStr = toDateInput(new Date());

  const sorted = [...blocks].sort(
    (a, b) => a.dataInicio.getTime() - b.dataInicio.getTime(),
  );

  return (
    <Card>
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Indisponibilidades</h3>
            <p className="text-sm text-muted-foreground">
              Datas em que este músico não pode tocar.
            </p>
          </div>
          {!open && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Bloquear data
            </Button>
          )}
        </div>

        {open && (
          <form
            action={(fd) => {
              fd.set("memberId", memberId);
              formAction(fd);
              if (!state?.error) setOpen(false);
            }}
            className="border border-border rounded-md p-4 space-y-3 bg-muted/20"
          >
            <input type="hidden" name="memberId" value={memberId} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dataInicio">Início</Label>
                <Input
                  id="dataInicio"
                  name="dataInicio"
                  type="date"
                  defaultValue={todayStr}
                  required
                />
                <FieldError state={state} name="dataInicio" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataFim">Fim</Label>
                <Input
                  id="dataFim"
                  name="dataFim"
                  type="date"
                  defaultValue={todayStr}
                  required
                />
                <FieldError state={state} name="dataFim" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo (opcional)</Label>
              <Input
                id="motivo"
                name="motivo"
                placeholder="Viagem, casamento, outro evento..."
              />
              <FieldError state={state} name="motivo" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Bloquear"}
              </Button>
            </div>
          </form>
        )}

        {sorted.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="Nenhuma indisponibilidade"
            description="Quando esse músico não puder tocar em alguma data, bloqueie aqui."
          />
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {sorted.map((b) => {
              const sameDia =
                b.dataInicio.toDateString() === b.dataFim.toDateString();
              return (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {sameDia
                        ? formatDataBR(b.dataInicio)
                        : `${formatDataBR(b.dataInicio)} → ${formatDataBR(b.dataFim)}`}
                    </p>
                    {b.motivo && (
                      <p className="text-xs text-muted-foreground">
                        {b.motivo}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    title="Remover"
                    onClick={() =>
                      startTransition(() => {
                        void deleteUnavailabilityAction(b.id);
                      })
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
