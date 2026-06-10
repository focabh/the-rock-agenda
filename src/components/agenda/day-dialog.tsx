"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  CalendarOff,
  CalendarPlus,
  CheckCircle2,
  Music2,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/shared/field-error";
import { RehearsalForm } from "@/components/agenda/rehearsal-manager";
import { createUnavailabilityAction } from "@/app/(app)/agenda/actions";
import { formatDataExtensa, formatDataBR, formatHoraBR } from "@/lib/formatters";
import { toast } from "sonner";
import type { Show, Venue, Member, Rehearsal, MemberUnavailability } from "@/db/schema";

type ShowItem = Show & { casa: Venue };

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toDateInput(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function UnavailabilityForm({
  date,
  endDate,
  isAdmin,
  currentMemberId,
  members,
  onDone,
}: {
  date: Date;
  endDate?: Date | null;
  isAdmin: boolean;
  currentMemberId: string | null;
  members: Member[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createUnavailabilityAction,
    null
  );
  const dStr = toDateInput(date);
  const fimStr = toDateInput(endDate ?? date);

  return (
    <form
      action={(fd) => {
        formAction(fd);
        setTimeout(() => {
          if (!state?.error && !state?.fieldErrors) {
            toast.success("Indisponibilidade marcada.");
            onDone();
          }
        }, 300);
      }}
      className="space-y-3"
    >
      {isAdmin ? (
        <div className="space-y-1.5">
          <Label htmlFor="memberId">Músico</Label>
          <select
            id="memberId"
            name="memberId"
            defaultValue={currentMemberId ?? ""}
            className={selectCls}
            required
          >
            <option value="">Selecione...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          <FieldError state={state} name="memberId" />
        </div>
      ) : (
        <input type="hidden" name="memberId" value={currentMemberId ?? ""} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dataInicio">Início</Label>
          <Input
            id="dataInicio"
            name="dataInicio"
            type="date"
            defaultValue={dStr}
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
            defaultValue={fimStr}
            required
          />
          <FieldError state={state} name="dataFim" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
        <Input id="motivo" name="motivo" placeholder="Compromisso pessoal, viagem..." />
        <FieldError state={state} name="motivo" />
      </div>
      {state?.error && !state.fieldErrors && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Voltar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Marcar indisponibilidade"}
        </Button>
      </div>
    </form>
  );
}

type Mode = "menu" | "ensaio" | "indisp";

export function DayDialog({
  date,
  endDate = null,
  initialMode = "menu",
  open,
  onOpenChange,
  shows,
  rehearsals,
  blocks = [],
  isAdmin,
  currentMemberId,
  members,
}: {
  date: Date | null;
  endDate?: Date | null;
  initialMode?: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shows: ShowItem[];
  rehearsals: Rehearsal[];
  blocks?: MemberUnavailability[];
  isAdmin: boolean;
  currentMemberId: string | null;
  members: Member[];
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  // Sempre que (re)abrir para um dia/intervalo, começa no modo certo.
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode, date?.getTime()]);

  function close() {
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  if (!date) return null;
  const dateParam = toDateInput(date);
  const isRange = Boolean(endDate && endDate.getTime() !== date.getTime());
  const rangeLabel = isRange
    ? `${formatDataBR(date)} → ${formatDataBR(endDate as Date)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={isRange ? "" : "capitalize"}>
            {rangeLabel ?? formatDataExtensa(date)}
          </DialogTitle>
          <DialogDescription>
            {mode === "menu"
              ? "O que você quer fazer neste dia?"
              : mode === "ensaio"
                ? "Novo ensaio"
                : isRange
                  ? "Marcar indisponibilidade no período"
                  : "Marcar indisponibilidade"}
          </DialogDescription>
        </DialogHeader>

        {/* Shows already scheduled that day — shortcut to confirm presence */}
        {mode === "menu" && shows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Shows neste dia
            </p>
            {shows.map((s) => (
              <Link
                key={s.id}
                href={`/shows/${s.id}`}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                onClick={close}
              >
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-mono text-muted-foreground mr-1.5">
                    {formatHoraBR(s.data)}
                  </span>
                  {s.casa.nome}
                </span>
                <span className="text-xs text-primary shrink-0">
                  Confirmar presença →
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Rehearsals already scheduled that day */}
        {mode === "menu" && rehearsals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Ensaios neste dia
            </p>
            {rehearsals.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm"
              >
                <Music2 className="size-4 text-emerald-400 shrink-0" />
                <span className="flex-1 min-w-0 truncate">
                  {r.inicio && (
                    <span className="font-mono text-muted-foreground mr-1.5">
                      {r.inicio}
                    </span>
                  )}
                  Ensaio
                  {r.foco ? ` · ${r.foco}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Indisponibilidades neste dia */}
        {mode === "menu" && blocks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Indisponibilidades neste dia
            </p>
            {blocks.map((bk) => {
              const m = members.find((x) => x.id === bk.memberId);
              const faixa =
                bk.horaInicio && bk.horaFim
                  ? `${bk.horaInicio}–${bk.horaFim}`
                  : bk.horaInicio
                    ? `a partir de ${bk.horaInicio}`
                    : "dia todo";
              return (
                <div
                  key={bk.id}
                  className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"
                >
                  <CalendarOff className="size-4 text-amber-400 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{m?.nome ?? "Músico"}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {faixa}
                      {bk.motivo ? ` · ${bk.motivo}` : ""}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {mode === "menu" && (
          <div className="grid gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setMode("ensaio")}
                >
                  <Music2 className="size-4 text-emerald-400" />
                  Marcar ensaio
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  render={<Link href={`/shows/novo?data=${dateParam}`} />}
                  onClick={close}
                >
                  <Ticket className="size-4 text-primary" />
                  Marcar show
                </Button>
              </>
            )}
            {currentMemberId || isAdmin ? (
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => setMode("indisp")}
              >
                <CalendarOff className="size-4 text-amber-400" />
                Marcar indisponibilidade
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground px-1">
                Seu login não está vinculado a um músico, então não há ações
                pessoais. Peça a um admin para vincular em Banda.
              </p>
            )}
          </div>
        )}

        {mode === "ensaio" && (
          <RehearsalForm defaultDate={date} onDone={close} />
        )}

        {mode === "indisp" && (
          <UnavailabilityForm
            date={date}
            endDate={endDate}
            isAdmin={isAdmin}
            currentMemberId={currentMemberId}
            members={members}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
