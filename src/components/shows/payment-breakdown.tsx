"use client";

import { useMemo, useState, useTransition } from "react";
import { DollarSign, RotateCcw, AlertTriangle, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBRL, parseBRLToCentavos } from "@/lib/formatters";
import { computePaymentBreakdown } from "@/lib/payment";
import {
  updateShowFinanceAction,
  setMemberPaymentAction,
  resetMemberPaymentAction,
  resetAllPaymentsAction,
} from "@/app/(app)/shows/[id]/actions-payment";
import { toast } from "sonner";
import type { Member, ShowMemberPayment } from "@/db/schema";

export function PaymentBreakdown({
  showId,
  cacheCentavos,
  applyCommission,
  commissionPct,
  confirmedMusicos,
  managerMember,
  overrides,
  admin,
}: {
  showId: string;
  cacheCentavos: number;
  applyCommission: boolean;
  commissionPct: number;
  confirmedMusicos: Member[];
  managerMember: Member | null;
  overrides: ShowMemberPayment[];
  admin: boolean;
}) {
  const [, startTransition] = useTransition();
  const [cacheInput, setCacheInput] = useState(
    cacheCentavos > 0 ? String(cacheCentavos / 100) : ""
  );
  const [pctInput, setPctInput] = useState(String(commissionPct));
  const [apply, setApply] = useState(applyCommission);

  const overrideMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of overrides) m.set(o.memberId, o.valorCentavos);
    return m;
  }, [overrides]);

  const breakdown = useMemo(
    () =>
      computePaymentBreakdown({
        cacheCentavos,
        applyCommission,
        commissionPct,
        confirmedMusicos,
        managerMember,
        overrides: overrideMap,
      }),
    [
      cacheCentavos,
      applyCommission,
      commissionPct,
      confirmedMusicos,
      managerMember,
      overrideMap,
    ]
  );

  function persistFinance(patch: {
    cacheCentavos?: number;
    applyCommission?: boolean;
    commissionPct?: number;
  }) {
    startTransition(async () => {
      await updateShowFinanceAction(showId, patch);
    });
  }

  function onCacheBlur() {
    const v = parseBRLToCentavos(cacheInput);
    if (v !== cacheCentavos) persistFinance({ cacheCentavos: v });
  }

  function onPctBlur() {
    const v = Number(pctInput.replace(",", "."));
    if (!Number.isFinite(v)) return;
    if (v !== commissionPct) persistFinance({ commissionPct: v });
  }

  function onApplyToggle(v: boolean) {
    setApply(v);
    persistFinance({ applyCommission: v });
  }

  function setOverride(memberId: string, valorCentavos: number) {
    startTransition(async () => {
      await setMemberPaymentAction(showId, memberId, valorCentavos);
    });
  }

  function clearOverride(memberId: string) {
    startTransition(async () => {
      await resetMemberPaymentAction(showId, memberId);
    });
  }

  function resetAll() {
    if (!confirm("Resetar todos os valores pra divisão automática?")) return;
    startTransition(async () => {
      await resetAllPaymentsAction(showId);
      toast.success("Valores resetados.");
    });
  }

  const noCache = cacheCentavos <= 0;
  const noMusicos = confirmedMusicos.length === 0;

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="size-4 text-primary" />
          <h3 className="font-semibold">Repartição do cachê</h3>
        </div>

        {/* Inputs principais */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cache-total" className="text-xs">
              Cachê total (R$)
            </Label>
            <Input
              id="cache-total"
              type="number"
              min={0}
              step={0.01}
              value={cacheInput}
              onChange={(e) => setCacheInput(e.target.value)}
              onBlur={onCacheBlur}
              disabled={!admin}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={apply}
                onChange={(e) => onApplyToggle(e.target.checked)}
                disabled={!admin}
                className="size-4 accent-primary"
              />
              Aplicar comissão (%)
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={pctInput}
              onChange={(e) => setPctInput(e.target.value)}
              onBlur={onPctBlur}
              disabled={!admin || !apply}
              className="font-mono"
              placeholder="10"
            />
          </div>
        </div>

        {noCache && (
          <p className="text-xs text-amber-300/80">
            Defina o cachê total acima pra calcular a repartição.
          </p>
        )}

        {/* Manager */}
        {apply && cacheCentavos > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {managerMember ? `Manager — ${managerMember.nome}` : "Comissão"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {commissionPct}% do cachê
              </p>
            </div>
            <p className="font-mono text-base">
              {formatBRL(breakdown.managerCentavos)}
            </p>
          </div>
        )}

        {/* Musicos confirmados */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Músicos confirmados ({confirmedMusicos.length})
            </p>
            {admin && overrides.length > 0 && (
              <button
                onClick={resetAll}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <RotateCcw className="size-3" />
                Resetar todos
              </button>
            )}
          </div>

          {noMusicos ? (
            <p className="text-sm text-muted-foreground py-3">
              Nenhum músico confirmado ainda. Marque presenças acima.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {confirmedMusicos.map((m) => {
                const info = breakdown.perMember.get(m.id)!;
                return (
                  <MemberPaymentRow
                    key={m.id}
                    member={m}
                    valorCentavos={info.valorCentavos}
                    manual={info.manual}
                    admin={admin}
                    onSet={(v) => setOverride(m.id, v)}
                    onReset={() => clearOverride(m.id)}
                  />
                );
              })}
            </ul>
          )}
        </div>

        {/* Totalizador */}
        {cacheCentavos > 0 && !noMusicos && (
          <div
            className={cn(
              "flex items-center justify-between rounded-md p-2.5 border",
              breakdown.overflow
                ? "border-red-500/40 bg-red-500/5"
                : "border-border bg-muted/20"
            )}
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              {breakdown.overflow && (
                <AlertTriangle className="size-3.5 text-red-400" />
              )}
              Total pago{" "}
              {breakdown.overflow && (
                <span className="text-red-400 normal-case">
                  excede o cachê
                </span>
              )}
            </div>
            <div className="font-mono">
              <span
                className={cn(
                  breakdown.overflow ? "text-red-300" : "text-foreground"
                )}
              >
                {formatBRL(breakdown.totalPagoCentavos)}
              </span>
              <span className="text-muted-foreground">
                {" / "}
                {formatBRL(cacheCentavos)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberPaymentRow({
  member,
  valorCentavos,
  manual,
  admin,
  onSet,
  onReset,
}: {
  member: Member;
  valorCentavos: number;
  manual: boolean;
  admin: boolean;
  onSet: (v: number) => void;
  onReset: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState((valorCentavos / 100).toString());

  function commit() {
    const v = parseBRLToCentavos(input);
    if (v !== valorCentavos) onSet(v);
    setEditing(false);
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.nome}</p>
        <p className="text-xs text-muted-foreground">{member.funcao}</p>
      </div>
      {manual && (
        <span
          className="text-[10px] uppercase tracking-wider text-amber-300"
          title="Valor editado manualmente"
        >
          manual
        </span>
      )}
      {editing && admin ? (
        <Input
          type="number"
          min={0}
          step={0.01}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setInput((valorCentavos / 100).toString());
              setEditing(false);
            }
          }}
          autoFocus
          className="w-28 h-8 font-mono text-right"
        />
      ) : (
        <button
          onClick={() => {
            if (admin) {
              setInput((valorCentavos / 100).toString());
              setEditing(true);
            }
          }}
          disabled={!admin}
          className={cn(
            "font-mono text-sm tabular-nums",
            admin && "hover:text-primary cursor-text"
          )}
          title={admin ? "Clique pra editar" : undefined}
        >
          {formatBRL(valorCentavos)}
        </button>
      )}
      {admin && manual && (
        <button
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground"
          title="Voltar pra divisão automática"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
    </li>
  );
}
