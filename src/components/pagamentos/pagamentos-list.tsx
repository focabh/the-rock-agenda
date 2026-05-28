"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Eye,
  Trash2,
  ExternalLink,
  Wallet,
  Ticket,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatBRL, formatDataBR } from "@/lib/formatters";
import { toast } from "sonner";
import {
  deletePaymentAction,
  getPaymentComprovanteAction,
} from "@/app/(app)/pagamentos/actions";

type Row = {
  id: string;
  tipo: "show" | "extra";
  showLabel: string | null;
  descricao: string;
  recipient: string;
  valorCentavos: number;
  paidEm: string; // ISO
};

export function PagamentosList({
  rows,
  admin,
}: {
  rows: Row[];
  admin: boolean;
}) {
  const [viewId, setViewId] = useState<string | null>(null);

  return (
    <>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <PaymentRow
            key={r.id}
            r={r}
            admin={admin}
            onView={() => setViewId(r.id)}
          />
        ))}
      </ul>
      {viewId && (
        <ComprovanteViewer
          paymentId={viewId}
          open={Boolean(viewId)}
          onOpenChange={(o) => !o && setViewId(null)}
        />
      )}
    </>
  );
}

function PaymentRow({
  r,
  admin,
  onView,
}: {
  r: Row;
  admin: boolean;
  onView: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm("Remover este pagamento do histórico?")) return;
    startTransition(async () => {
      await deletePaymentAction(r.id);
      toast.success("Pagamento removido.");
    });
  }

  // wa.me texto-only: o admin precisa anexar o comprovante manualmente
  // no WhatsApp (Web Share API com data URL é instável entre browsers).
  const waText = encodeURIComponent(
    `Comprovante de pagamento — ${r.descricao} — ${formatBRL(r.valorCentavos)} (${formatDataBR(new Date(r.paidEm))}).`
  );
  const waUrl = `https://wa.me/?text=${waText}`;

  const Icon = r.tipo === "show" ? Ticket : Box;

  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{r.descricao}</p>
        <p className="text-xs text-muted-foreground truncate">
          Para <span className="text-foreground">{r.recipient}</span>
          {r.showLabel && <> · {r.showLabel}</>}
          {" · "}
          {formatDataBR(new Date(r.paidEm))}
        </p>
      </div>
      <span className="font-mono text-sm shrink-0">
        {formatBRL(r.valorCentavos)}
      </span>
      <Button size="sm" variant="ghost" title="Ver comprovante" onClick={onView}>
        <Eye className="size-4" />
      </Button>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Compartilhar texto no WhatsApp (anexe o comprovante manualmente)"
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50"
      >
        <ExternalLink className="size-4" />
      </a>
      {admin && (
        <Button
          size="sm"
          variant="ghost"
          title="Remover"
          onClick={onDelete}
          disabled={pending}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}

function ComprovanteViewer({
  paymentId,
  open,
  onOpenChange,
}: {
  paymentId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPaymentComprovanteAction(paymentId).then((r) => {
      if (!active) return;
      setUrl(r.url);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [paymentId]);

  const isPdf = url?.startsWith("data:application/pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprovante PIX</DialogTitle>
          <DialogDescription>
            Anexado no registro do pagamento.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            <Wallet className="size-5 mx-auto mb-2 opacity-50" /> Carregando…
          </p>
        ) : !url ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem comprovante.
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
