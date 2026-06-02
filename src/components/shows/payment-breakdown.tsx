"use client";

import { useMemo, useState, useTransition } from "react";
import { DollarSign, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatBRL, parseBRLToCentavos } from "@/lib/formatters";
import { computePaymentBreakdown, memberDefaultCentavos } from "@/lib/payment";
import {
  updateShowFinanceAction,
  setMemberPaymentAction,
  resetMemberPaymentAction,
  resetAllPaymentsAction,
} from "@/app/(app)/shows/[id]/actions-payment";
import {
  MemberPaidControls,
  type PaidStatus,
} from "@/components/shows/payment-paid-controls";
import { toast } from "sonner";
import type { Member, ShowMemberPayment, ShowSubstitute } from "@/db/schema";

type PaidInfo = {
  memberId: string;
  status: "aguardando" | "confirmado";
  hasComprovante: boolean;
};

export function PaymentBreakdown({
  showId,
  cacheCentavos,
  applyCommission,
  commissionPct,
  confirmedMusicos,
  managerMember,
  overrides,
  admin,
  paidInfo,
  currentMemberId,
  subs = [],
}: {
  showId: string;
  cacheCentavos: number;
  applyCommission: boolean;
  commissionPct: number;
  confirmedMusicos: Member[];
  managerMember: Member | null;
  overrides: ShowMemberPayment[];
  admin: boolean;
  paidInfo: PaidInfo[];
  currentMemberId: string | null;
  subs?: ShowSubstitute[];
}) {
  const [, startTransition] = useTransition();
  const paidMap = useMemo(
    () => new Map(paidInfo.map((p) => [p.memberId, p])),
    [paidInfo]
  );

  const [cacheInput, setCacheInput] = useState(
    cacheCentavos > 0 ? String(cacheCentavos / 100) : ""
  );
  const [pctInput, setPctInput] = useState(String(commissionPct));
  const [apply, setApply] = useState(applyCommission);

  // Override REAL do show (editável/resetável aqui), por músico.
  const showOverride = useMemo(() => new Map(overrides.map((o) => [o.memberId, o])), [overrides]);

  // Valor efetivo por músico (centavos): override do show vence; senão, o
  // pagamento PADRÃO do músico (perfil) — fixo ou % do cachê.
  const overrideMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const mem of confirmedMusicos) {
      const o = showOverride.get(mem.id);
      if (o) {
        m.set(mem.id, o.pct != null ? Math.round((cacheCentavos * o.pct) / 100) : o.valorCentavos);
      } else {
        const d = memberDefaultCentavos(mem, cacheCentavos);
        if (d != null) m.set(mem.id, d);
      }
    }
    return m;
  }, [showOverride, confirmedMusicos, cacheCentavos]);

  // Percentual efetivo (memberId -> pct) pra UI mostrar/editar "%".
  const pctMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const mem of confirmedMusicos) {
      const o = showOverride.get(mem.id);
      if (o) {
        if (o.pct != null) m.set(mem.id, o.pct);
      } else if (mem.pagamentoFixoCentavos == null && (mem.percentualDivisao ?? 0) > 0) {
        m.set(mem.id, mem.percentualDivisao as number);
      }
    }
    return m;
  }, [showOverride, confirmedMusicos]);

  // Participantes da divisão = músicos confirmados + subs convidados.
  const participantes = useMemo(
    () => [...confirmedMusicos.map((m) => ({ id: m.id })), ...subs.map((s) => ({ id: s.id }))],
    [confirmedMusicos, subs]
  );

  const breakdown = useMemo(
    () =>
      computePaymentBreakdown({
        cacheCentavos,
        applyCommission,
        commissionPct,
        confirmedMusicos: participantes,
        managerMember,
        overrides: overrideMap,
      }),
    [cacheCentavos, applyCommission, commissionPct, participantes, managerMember, overrideMap]
  );

  const musicoTotal =
    confirmedMusicos.reduce((s, m) => s + (breakdown.perMember.get(m.id)?.valorCentavos ?? 0), 0) +
    subs.reduce((s, sub) => s + (breakdown.perMember.get(sub.id)?.valorCentavos ?? 0), 0);
  const paidTotal = confirmedMusicos.reduce(
    (s, m) =>
      paidMap.has(m.id)
        ? s + (breakdown.perMember.get(m.id)?.valorCentavos ?? 0)
        : s,
    0
  );
  const paidCount = confirmedMusicos.filter((m) => paidMap.has(m.id)).length;
  const confirmedCount = confirmedMusicos.filter(
    (m) => paidMap.get(m.id)?.status === "confirmado"
  ).length;

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
      await setMemberPaymentAction(showId, memberId, valorCentavos, null);
    });
  }

  function setOverridePct(memberId: string, pct: number) {
    startTransition(async () => {
      await setMemberPaymentAction(showId, memberId, 0, pct);
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
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-primary" />
            <h3 className="font-semibold">Repartição do cachê</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Quanto cada músico recebe e quem já foi pago (banda → músicos). O
            recebimento do contratante (contratante → banda) fica no{" "}
            <strong className="text-foreground">status de pagamento</strong> do
            show, no Resumo.
          </p>
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
              Músicos confirmados ({confirmedMusicos.length}){subs.length > 0 ? ` + ${subs.length} sub` : ""}
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

          {noMusicos && subs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">
              Nenhum músico confirmado ainda. Marque presenças acima.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {confirmedMusicos.map((m) => {
                const info = breakdown.perMember.get(m.id)!;
                const paid = paidMap.get(m.id);
                return (
                  <MemberPaymentRow
                    key={m.id}
                    showId={showId}
                    member={m}
                    valorCentavos={info.valorCentavos}
                    manual={info.manual}
                    isShowOverride={showOverride.has(m.id)}
                    pct={pctMap.get(m.id) ?? null}
                    admin={admin}
                    paidStatus={paid ? paid.status : "none"}
                    hasComprovante={paid?.hasComprovante ?? false}
                    isSelf={currentMemberId === m.id}
                    onSet={(v) => setOverride(m.id, v)}
                    onSetPct={(p) => setOverridePct(m.id, p)}
                    onReset={() => clearOverride(m.id)}
                  />
                );
              })}
              {/* Subs convidados — entram na divisão, sem controle de pago aqui */}
              {subs.map((sub) => {
                const info = breakdown.perMember.get(sub.id);
                return (
                  <li key={sub.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sub.nome}{" "}
                        <span className="rounded bg-sky-500/15 px-1 py-0.5 text-[10px] font-bold uppercase text-sky-300">sub</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{sub.funcao || "Convidado"}</p>
                    </div>
                    <span className="font-mono text-sm tabular-nums">{formatBRL(info?.valorCentavos ?? 0)}</span>
                  </li>
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

        {/* Repasse aos músicos (banda -> músico) */}
        {!noMusicos && (
          <div className="flex items-center justify-between rounded-md p-2.5 border border-border bg-muted/20">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Repasse aos músicos
            </span>
            <span className="text-sm">
              <span
                className={cn(
                  "font-mono",
                  paidCount === confirmedMusicos.length
                    ? "text-emerald-300"
                    : "text-foreground"
                )}
              >
                {formatBRL(paidTotal)}
              </span>
              <span className="text-muted-foreground">
                {" / "}
                {formatBRL(musicoTotal)}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {paidCount}/{confirmedMusicos.length} pagos
                {paidCount > 0 && ` · ${confirmedCount} confirmados`}
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberPaymentRow({
  showId,
  member,
  valorCentavos,
  manual,
  isShowOverride,
  pct,
  admin,
  paidStatus,
  hasComprovante,
  isSelf,
  onSet,
  onSetPct,
  onReset,
}: {
  showId: string;
  member: Member;
  valorCentavos: number;
  manual: boolean;
  isShowOverride: boolean;
  pct: number | null;
  admin: boolean;
  paidStatus: PaidStatus;
  hasComprovante: boolean;
  isSelf: boolean;
  onSet: (v: number) => void;
  onSetPct: (p: number) => void;
  onReset: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // modo de edição: "fixo" (R$) ou "pct" (%)
  const [modo, setModo] = useState<"fixo" | "pct">(pct != null ? "pct" : "fixo");
  const [input, setInput] = useState(
    pct != null ? String(pct) : (valorCentavos / 100).toString()
  );

  function startEdit() {
    if (!admin) return;
    const m: "fixo" | "pct" = pct != null ? "pct" : "fixo";
    setModo(m);
    setInput(m === "pct" ? String(pct) : (valorCentavos / 100).toString());
    setEditing(true);
  }

  function commit() {
    if (modo === "pct") {
      const p = Number(input.replace(",", "."));
      if (Number.isFinite(p)) onSetPct(Math.max(0, Math.min(100, p)));
    } else {
      const v = parseBRLToCentavos(input);
      if (v !== valorCentavos || pct != null) onSet(v);
    }
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
          className={cn(
            "text-[10px] uppercase tracking-wider",
            isShowOverride ? "text-amber-300" : "text-sky-300"
          )}
          title={
            isShowOverride
              ? pct != null
                ? "Percentual do cachê (deste show)"
                : "Valor fixo deste show"
              : "Pagamento padrão do músico (perfil) — edite pra valer só neste show"
          }
        >
          {isShowOverride ? (pct != null ? `${pct}%` : "fixo") : pct != null ? `${pct}% padrão` : "padrão"}
        </span>
      )}
      {editing && admin ? (
        <div className="flex items-center gap-1">
          <div className="inline-flex h-8 overflow-hidden rounded-md ring-1 ring-border">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setModo("fixo")}
              className={cn("px-2 text-xs font-semibold", modo === "fixo" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              R$
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setModo("pct")}
              className={cn("px-2 text-xs font-semibold", modo === "pct" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              %
            </button>
          </div>
          <Input
            type="number"
            min={0}
            max={modo === "pct" ? 100 : undefined}
            step={modo === "pct" ? 1 : 0.01}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="w-24 h-8 font-mono text-right"
          />
        </div>
      ) : (
        <button
          onClick={startEdit}
          disabled={!admin}
          className={cn(
            "font-mono text-sm tabular-nums",
            admin && "hover:text-primary cursor-text"
          )}
          title={admin ? "Clique pra editar (R$ ou %)" : undefined}
        >
          {formatBRL(valorCentavos)}
        </button>
      )}
      {admin && isShowOverride && (
        <button
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground"
          title="Voltar pro padrão / divisão automática"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
      <MemberPaidControls
        showId={showId}
        memberId={member.id}
        memberNome={member.nome}
        status={paidStatus}
        hasComprovante={hasComprovante}
        admin={admin}
        isSelf={isSelf}
      />
    </li>
  );
}
