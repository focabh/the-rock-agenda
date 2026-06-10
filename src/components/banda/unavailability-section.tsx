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
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

function toDateInput(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** "14:00–18:00" / "a partir de 14:00" / "até 18:00" — só quando há hora. */
function horaLabel(ini?: string | null, fim?: string | null): string | null {
  if (ini && fim) return `${ini}–${fim}`;
  if (ini) return `a partir de ${ini}`;
  if (fim) return `até ${fim}`;
  return null;
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

  // Fecha só no sucesso; conflito (erro) mantém o form aberto com a mensagem.
  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      toast.success("Indisponibilidade marcada.");
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Atalhos: a partir de hoje, por N dias.
  function quickRange(days: number) {
    const hoje = new Date();
    const ini = document.getElementById("dataInicio") as HTMLInputElement | null;
    const fim = document.getElementById("dataFim") as HTMLInputElement | null;
    if (ini) ini.value = toDateInput(hoje);
    if (fim) fim.value = toDateInput(addDays(hoje, days));
  }

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
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center">
                Atalhos:
              </span>
              {[
                { label: "Só hoje", days: 0 },
                { label: "7 dias", days: 6 },
                { label: "15 dias", days: 14 },
                { label: "30 dias", days: 29 },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => quickRange(q.days)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent/50"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="horaInicio">Hora início (opcional)</Label>
                <Input id="horaInicio" name="horaInicio" type="time" />
                <FieldError state={state} name="horaInicio" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="horaFim">Hora fim (opcional)</Label>
                <Input id="horaFim" name="horaFim" type="time" />
                <FieldError state={state} name="horaFim" />
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
            {state?.error && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                {state.error}{" "}
                <span className="text-muted-foreground">
                  Pra informar suas 3 datas alternativas, marque pela{" "}
                  <strong>Agenda</strong> (clique no dia).
                </span>
              </p>
            )}
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
              const hora = horaLabel(b.horaInicio, b.horaFim);
              return (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {sameDia
                        ? formatDataBR(b.dataInicio)
                        : `${formatDataBR(b.dataInicio)} → ${formatDataBR(b.dataFim)}`}
                      {hora && (
                        <span className="font-mono text-muted-foreground ml-2 text-xs">
                          {hora}
                        </span>
                      )}
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
