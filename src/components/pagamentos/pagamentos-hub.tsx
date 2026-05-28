"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  X,
  Eye,
  Music2,
  Receipt,
  Trash2,
  Coins,
  Wallet,
  Paperclip,
  ChevronRight,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatBRL, formatDataBR } from "@/lib/formatters";
import { toast } from "sonner";
import {
  MarkPaidDialog,
  CacheComprovanteViewer,
} from "@/components/shows/payment-paid-controls";
import {
  confirmMemberPaymentAction,
  reportNotReceivedAction,
} from "@/app/(app)/shows/[id]/actions-payment";
import {
  confirmReembolsoAction,
  reportReembolsoNotReceivedAction,
  deleteReembolsoAction,
  getReembolsoComprovanteAction,
} from "@/app/(app)/pagamentos/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useEffect } from "react";

export type CacheItem = {
  showId: string;
  showLabel: string;
  showData: string;
  memberId: string;
  memberNome: string;
  valorCentavos: number;
  status: "a_pagar" | "aguardando" | "confirmado";
  hasComprovante: boolean;
  pagoEmISO: string | null;
};

export type ReembolsoItem = {
  id: string;
  memberId: string;
  memberNome: string;
  descricao: string;
  valorCentavos: number;
  status: "aguardando" | "confirmado";
  hasComprovante: boolean;
  paidEmISO: string;
};

export type ContratanteItem = {
  showId: string;
  showLabel: string;
  showData: string;
  valorCentavos: number;
  pagamentoStatus: string;
};

export function PagamentosHub({
  cacheItems,
  reembolsoItems,
  contratanteItems,
  admin,
  currentMemberId,
}: {
  cacheItems: CacheItem[];
  reembolsoItems: ReembolsoItem[];
  contratanteItems: ContratanteItem[];
  admin: boolean;
  currentMemberId: string | null;
}) {
  const groups = useMemo(() => {
    return {
      caches_aPagar: cacheItems.filter((c) => c.status === "a_pagar"),
      caches_aguardando: cacheItems.filter((c) => c.status === "aguardando"),
      caches_confirmados: cacheItems.filter((c) => c.status === "confirmado"),
      reembolsos_aguardando: reembolsoItems.filter(
        (r) => r.status === "aguardando"
      ),
      reembolsos_confirmados: reembolsoItems.filter(
        (r) => r.status === "confirmado"
      ),
    };
  }, [cacheItems, reembolsoItems]);

  const totalAPagar = groups.caches_aPagar.reduce(
    (s, c) => s + c.valorCentavos,
    0
  );
  const totalAguardandoCache = groups.caches_aguardando.reduce(
    (s, c) => s + c.valorCentavos,
    0
  );
  const totalAReceberContratante = contratanteItems.reduce(
    (s, c) => s + c.valorCentavos,
    0
  );

  return (
    <div className="space-y-6">
      {/* Stats top */}
      {admin && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            tone="amber"
            label="A pagar aos músicos"
            value={formatBRL(totalAPagar)}
            sub={`${groups.caches_aPagar.length} pendente(s)`}
          />
          <Stat
            tone="default"
            label="Aguardando confirmação"
            value={formatBRL(totalAguardandoCache)}
            sub={`${groups.caches_aguardando.length} músico(s)`}
          />
          <Stat
            tone="amber"
            label="A receber do contratante"
            value={formatBRL(totalAReceberContratante)}
            sub={`${contratanteItems.length} show(s)`}
          />
        </div>
      )}

      {/* === ADMIN: a pagar aos músicos === */}
      {admin && groups.caches_aPagar.length > 0 && (
        <GroupedSection
          title="A pagar aos músicos"
          tone="amber"
          subtitle="Cachês de shows com músico confirmado, ainda sem pagamento registrado. Clique no show pra ver os músicos."
          items={groups.caches_aPagar}
          admin
          currentMemberId={currentMemberId}
        />
      )}

      {/* === MUSICIAN: a receber === */}
      {!admin && groups.caches_aPagar.length > 0 && (
        <GroupedSection
          title="Cachês a receber"
          tone="amber"
          subtitle="Shows que você confirmou presença, ainda aguardando pagamento."
          items={groups.caches_aPagar}
          admin={false}
          currentMemberId={currentMemberId}
        />
      )}

      {/* === Aguardando confirmação (ambos) === */}
      {groups.caches_aguardando.length > 0 && (
        <GroupedSection
          title={
            admin ? "Aguardando confirmação dos músicos" : "Aguardando sua confirmação"
          }
          tone={admin ? "default" : "amber"}
          subtitle={
            admin
              ? "Você marcou pago. O músico precisa confirmar o recebimento."
              : "O admin marcou que pagou. Confira o comprovante e confirme."
          }
          items={groups.caches_aguardando}
          admin={admin}
          currentMemberId={currentMemberId}
        />
      )}

      {/* === ADMIN: a receber do contratante === */}
      {admin && contratanteItems.length > 0 && (
        <Section
          title="A receber do contratante"
          tone="amber"
          subtitle="Shows concluídos onde a banda ainda não recebeu (ou recebeu parcialmente). Abra o show pra ajustar o status."
        >
          {contratanteItems.map((c) => (
            <li
              key={c.showId}
              className="flex items-center gap-3 px-5 py-3"
            >
              <div className="flex size-10 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/30 shrink-0">
                <Coins className="size-4 text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.showLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDataBR(new Date(c.showData))} · status{" "}
                  <span className="text-amber-300">{c.pagamentoStatus}</span>
                </p>
              </div>
              <span className="font-mono text-sm shrink-0">
                {formatBRL(c.valorCentavos)}
              </span>
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/shows/${c.showId}`} />}
              >
                Abrir
              </Button>
            </li>
          ))}
        </Section>
      )}

      {/* === Reembolsos pendentes === */}
      {groups.reembolsos_aguardando.length > 0 && (
        <Section
          title={
            admin ? "Reembolsos aguardando confirmação" : "Reembolsos aguardando sua confirmação"
          }
          tone="default"
        >
          {groups.reembolsos_aguardando.map((r) => (
            <ReembolsoRow
              key={r.id}
              item={r}
              admin={admin}
              isSelf={currentMemberId === r.memberId}
            />
          ))}
        </Section>
      )}

      {/* === Histórico (cachês confirmados + reembolsos confirmados) === */}
      {(groups.caches_confirmados.length > 0 ||
        groups.reembolsos_confirmados.length > 0) && (
        <Section
          title={admin ? "Histórico" : "Recebidos"}
          subtitle={`Total: ${formatBRL(
            groups.caches_confirmados.reduce((s, c) => s + c.valorCentavos, 0) +
              groups.reembolsos_confirmados.reduce(
                (s, r) => s + r.valorCentavos,
                0
              )
          )}`}
        >
          {[...groups.caches_confirmados]
            .sort((a, b) => (b.pagoEmISO ?? "").localeCompare(a.pagoEmISO ?? ""))
            .slice(0, 30)
            .map((c) => (
              <CacheRow
                key={`${c.showId}-${c.memberId}-h`}
                item={c}
                admin={admin}
                isSelf={currentMemberId === c.memberId}
              />
            ))}
          {[...groups.reembolsos_confirmados]
            .sort((a, b) => b.paidEmISO.localeCompare(a.paidEmISO))
            .slice(0, 30)
            .map((r) => (
              <ReembolsoRow
                key={`${r.id}-h`}
                item={r}
                admin={admin}
                isSelf={currentMemberId === r.memberId}
              />
            ))}
        </Section>
      )}
    </div>
  );
}

function Stat({
  tone = "default",
  label,
  value,
  sub,
}: {
  tone?: "default" | "amber";
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <div className="py-4 px-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "text-xl font-mono mt-1",
            tone === "amber" ? "text-amber-300" : "text-foreground"
          )}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </Card>
  );
}

function Section({
  title,
  subtitle,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: "default" | "amber";
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2
          className={cn(
            "text-sm font-semibold uppercase tracking-wider",
            tone === "amber" ? "text-amber-300" : "text-muted-foreground"
          )}
        >
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">{children}</ul>
      </Card>
    </section>
  );
}

/** Agrupa cachês por show — header com total + nº de músicos, expansível. */
function GroupedSection({
  title,
  subtitle,
  tone,
  items,
  admin,
  currentMemberId,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  tone?: "default" | "amber";
  items: CacheItem[];
  admin: boolean;
  currentMemberId: string | null;
  defaultOpen?: boolean;
}) {
  // Agrupa por showId preservando ordem (mais recente primeiro pelos itens).
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { showLabel: string; showData: string; items: CacheItem[] }
    >();
    for (const it of items) {
      if (!map.has(it.showId)) {
        map.set(it.showId, {
          showLabel: it.showLabel,
          showData: it.showData,
          items: [],
        });
      }
      map.get(it.showId)!.items.push(it);
    }
    return Array.from(map.entries())
      .map(([showId, v]) => ({ showId, ...v }))
      .sort((a, b) => b.showData.localeCompare(a.showData));
  }, [items]);

  return (
    <section className="space-y-2">
      <div>
        <h2
          className={cn(
            "text-sm font-semibold uppercase tracking-wider",
            tone === "amber" ? "text-amber-300" : "text-muted-foreground"
          )}
        >
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-2">
        {groups.map((g) => {
          const total = g.items.reduce((s, x) => s + x.valorCentavos, 0);
          return (
            <details
              key={g.showId}
              open={defaultOpen}
              className="group rounded-md border border-border bg-card overflow-hidden"
            >
              <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer select-none hover:bg-accent/30 list-none">
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
                  <Music2 className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{g.showLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDataBR(new Date(g.showData))} · {g.items.length} músico
                    {g.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-mono text-sm shrink-0",
                    tone === "amber" ? "text-amber-300" : "text-foreground"
                  )}
                >
                  {formatBRL(total)}
                </span>
              </summary>
              <ul className="divide-y divide-border bg-muted/10">
                {g.items.map((c) => (
                  <CacheRow
                    key={`${c.showId}-${c.memberId}`}
                    item={c}
                    admin={admin}
                    isSelf={currentMemberId === c.memberId}
                    compact
                  />
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: "aguardando" | "confirmado" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        status === "confirmado"
          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
          : "bg-amber-500/15 text-amber-300 ring-amber-500/40"
      )}
    >
      {status === "confirmado" ? (
        <Check className="size-3" />
      ) : (
        <Clock className="size-3" />
      )}
      {status === "confirmado" ? "Confirmado" : "Aguardando"}
    </span>
  );
}

function CacheRow({
  item,
  admin,
  isSelf,
  compact = false,
}: {
  item: CacheItem;
  admin: boolean;
  isSelf: boolean;
  /** Renderiza no contexto de um grupo (sem repetir o show + ícone do show). */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [markOpen, setMarkOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  function confirmar() {
    startTransition(async () => {
      const r = await confirmMemberPaymentAction(item.showId, item.memberId);
      if (r?.error) toast.error(r.error);
      else toast.success("Recebimento confirmado. 🤘");
    });
  }
  function naoRecebi() {
    if (!confirm("Informar que você NÃO recebeu este cachê?")) return;
    startTransition(async () => {
      const r = await reportNotReceivedAction(item.showId, item.memberId);
      if (r?.error) toast.error(r.error);
      else toast.success("Avisamos o admin.");
    });
  }

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      {compact ? (
        <div className="flex size-8 items-center justify-center rounded-md bg-muted/40 shrink-0">
          <User className="size-4 text-muted-foreground" />
        </div>
      ) : (
        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
          <Music2 className="size-4 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {compact ? (
          <p className="font-medium truncate">{item.memberNome}</p>
        ) : (
          <Link
            href={`/shows/${item.showId}`}
            className="font-medium truncate hover:text-primary"
          >
            Cachê — {item.showLabel}
          </Link>
        )}
        <p className="text-xs text-muted-foreground truncate">
          {!compact && admin && <>Pra {item.memberNome} · </>}
          {item.pagoEmISO
            ? `Pago em ${formatDataBR(new Date(item.pagoEmISO))}`
            : compact
              ? null
              : `Show em ${formatDataBR(new Date(item.showData))}`}
        </p>
      </div>
      <span className="font-mono text-sm shrink-0">
        {formatBRL(item.valorCentavos)}
      </span>
      {item.status !== "a_pagar" && (
        <StatusBadge status={item.status === "aguardando" ? "aguardando" : "confirmado"} />
      )}
      {item.hasComprovante && (admin || isSelf) && (
        <Button
          size="sm"
          variant="ghost"
          title="Ver comprovante"
          onClick={() => setViewOpen(true)}
        >
          <Eye className="size-4" />
        </Button>
      )}
      {/* Pagar (admin, a_pagar) */}
      {admin && item.status === "a_pagar" && (
        <Button size="sm" onClick={() => setMarkOpen(true)}>
          <Paperclip className="size-3.5" />
          Pagar
        </Button>
      )}
      {/* Confirmar / Não recebi (músico self em aguardando) */}
      {item.status === "aguardando" && isSelf && (
        <>
          <Button size="sm" onClick={confirmar} disabled={pending}>
            <Check className="size-3.5" />
            Confirmar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Não recebi"
            onClick={naoRecebi}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-4" />
          </Button>
        </>
      )}

      {markOpen && (
        <MarkPaidDialog
          showId={item.showId}
          memberId={item.memberId}
          memberNome={item.memberNome}
          open={markOpen}
          onOpenChange={setMarkOpen}
        />
      )}
      {viewOpen && (
        <CacheComprovanteViewer
          showId={item.showId}
          memberId={item.memberId}
          open={viewOpen}
          onOpenChange={setViewOpen}
        />
      )}
    </li>
  );
}

function ReembolsoRow({
  item,
  admin,
  isSelf,
}: {
  item: ReembolsoItem;
  admin: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [viewOpen, setViewOpen] = useState(false);

  function confirmar() {
    startTransition(async () => {
      const r = await confirmReembolsoAction(item.id);
      if (r?.error) toast.error(r.error);
      else toast.success("Recebimento confirmado. 🤘");
    });
  }
  function naoRecebi() {
    if (!confirm("Informar que você NÃO recebeu este reembolso?")) return;
    startTransition(async () => {
      const r = await reportReembolsoNotReceivedAction(item.id);
      if (r?.error) toast.error(r.error);
      else toast.success("Avisamos o admin.");
    });
  }
  function remover() {
    if (!confirm("Remover este reembolso?")) return;
    startTransition(async () => {
      await deleteReembolsoAction(item.id);
      toast.success("Reembolso removido.");
    });
  }

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
        <Receipt className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">Reembolso — {item.descricao}</p>
        <p className="text-xs text-muted-foreground truncate">
          {admin && <>Pra {item.memberNome} · </>}
          {formatDataBR(new Date(item.paidEmISO))}
        </p>
      </div>
      <span className="font-mono text-sm shrink-0">
        {formatBRL(item.valorCentavos)}
      </span>
      <StatusBadge status={item.status} />
      {item.hasComprovante && (admin || isSelf) && (
        <Button
          size="sm"
          variant="ghost"
          title="Ver comprovante"
          onClick={() => setViewOpen(true)}
        >
          <Eye className="size-4" />
        </Button>
      )}
      {item.status === "aguardando" && isSelf && (
        <>
          <Button size="sm" onClick={confirmar} disabled={pending}>
            <Check className="size-3.5" />
            Confirmar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Não recebi"
            onClick={naoRecebi}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-4" />
          </Button>
        </>
      )}
      {admin && (
        <Button
          size="sm"
          variant="ghost"
          title="Remover"
          onClick={remover}
          disabled={pending}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
      {viewOpen && (
        <ReembolsoComprovanteDialog
          reembolsoId={item.id}
          open={viewOpen}
          onOpenChange={setViewOpen}
        />
      )}
    </li>
  );
}

function ReembolsoComprovanteDialog({
  reembolsoId,
  open,
  onOpenChange,
}: {
  reembolsoId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getReembolsoComprovanteAction(reembolsoId).then((r) => {
      if (!active) return;
      setUrl(r.url);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reembolsoId]);

  const isPdf = url?.startsWith("data:application/pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprovante PIX (reembolso)</DialogTitle>
          <DialogDescription>
            <Wallet className="size-3.5 inline opacity-60" /> Anexado pelo admin.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Carregando…
          </p>
        ) : !url ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem comprovante (ou sem acesso).
          </p>
        ) : isPdf ? (
          <iframe
            src={url}
            title="Comprovante PDF"
            className="h-[60vh] w-full rounded-md border border-border"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Comprovante"
            className="max-h-[70vh] w-full rounded-md object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
