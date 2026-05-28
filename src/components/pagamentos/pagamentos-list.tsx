"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Eye,
  Trash2,
  Check,
  X,
  Music2,
  Receipt,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatBRL, formatDataBR } from "@/lib/formatters";
import { toast } from "sonner";
import {
  confirmReembolsoAction,
  reportReembolsoNotReceivedAction,
  deleteReembolsoAction,
  getReembolsoComprovanteAction,
  getCacheComprovanteAction,
} from "@/app/(app)/pagamentos/actions";
import {
  confirmMemberPaymentAction,
  reportNotReceivedAction,
} from "@/app/(app)/shows/[id]/actions-payment";

export type PagamentoRow = {
  kind: "cache" | "reembolso";
  id: string; // sintético pra "cache"
  showId: string | null;
  memberId: string;
  memberNome: string;
  descricao: string;
  contexto: string | null;
  valorCentavos: number | null;
  status: "aguardando" | "confirmado";
  hasComprovante: boolean;
  paidEm: string;
};

export function PagamentosList({
  rows,
  currentMemberId,
  admin,
}: {
  rows: PagamentoRow[];
  currentMemberId: string | null;
  admin: boolean;
}) {
  const [view, setView] = useState<PagamentoRow | null>(null);
  return (
    <>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <Row
            key={`${r.kind}-${r.id}`}
            r={r}
            isSelf={currentMemberId === r.memberId}
            admin={admin}
            onView={() => setView(r)}
          />
        ))}
      </ul>
      {view && (
        <ComprovanteDialog
          row={view}
          open={Boolean(view)}
          onOpenChange={(o) => !o && setView(null)}
        />
      )}
    </>
  );
}

function Row({
  r,
  isSelf,
  admin,
  onView,
}: {
  r: PagamentoRow;
  isSelf: boolean;
  admin: boolean;
  onView: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const result =
        r.kind === "cache"
          ? await confirmMemberPaymentAction(r.showId!, r.memberId)
          : await confirmReembolsoAction(r.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Recebimento confirmado. 🤘");
    });
  }
  function naoRecebi() {
    if (!confirm("Informar que você NÃO recebeu este pagamento?")) return;
    startTransition(async () => {
      const result =
        r.kind === "cache"
          ? await reportNotReceivedAction(r.showId!, r.memberId)
          : await reportReembolsoNotReceivedAction(r.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Avisamos o admin.");
    });
  }
  function remover() {
    if (r.kind !== "reembolso") return; // cachê é gerenciado no show
    if (!confirm("Remover este reembolso?")) return;
    startTransition(async () => {
      await deleteReembolsoAction(r.id);
      toast.success("Reembolso removido.");
    });
  }

  const Icon = r.kind === "cache" ? Music2 : Receipt;

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{r.descricao}</p>
        <p className="text-xs text-muted-foreground truncate">
          {admin && r.memberNome && <>Pra {r.memberNome} · </>}
          {r.contexto && <>{r.contexto} · </>}
          {formatDataBR(new Date(r.paidEm))}
        </p>
      </div>
      {r.valorCentavos !== null && (
        <span className="font-mono text-sm shrink-0">
          {formatBRL(r.valorCentavos)}
        </span>
      )}
      <StatusBadge status={r.status} />
      {r.hasComprovante && (
        <Button size="sm" variant="ghost" title="Ver comprovante" onClick={onView}>
          <Eye className="size-4" />
        </Button>
      )}
      {r.status === "aguardando" && isSelf && (
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
      {admin && r.kind === "reembolso" && (
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
    </li>
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

function ComprovanteDialog({
  row,
  open,
  onOpenChange,
}: {
  row: PagamentoRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const p =
      row.kind === "cache"
        ? getCacheComprovanteAction(row.showId!, row.memberId)
        : getReembolsoComprovanteAction(row.id);
    p.then((r) => {
      if (!active) return;
      setUrl(r.url);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [row]);

  const isPdf = url?.startsWith("data:application/pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprovante PIX</DialogTitle>
          <DialogDescription>{row.descricao}</DialogDescription>
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
