"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Clock, Paperclip, Eye, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fileToDataUrl } from "@/lib/upload-helpers";
import {
  markMemberPaidAction,
  confirmMemberPaymentAction,
  reportNotReceivedAction,
  unmarkMemberPaidAction,
  getComprovanteAction,
} from "@/app/(app)/shows/[id]/actions-payment";

export type PaidStatus = "none" | "aguardando" | "confirmado";

export function MemberPaidControls({
  showId,
  memberId,
  memberNome,
  status,
  hasComprovante,
  admin,
  isSelf,
}: {
  showId: string;
  memberId: string;
  memberNome: string;
  status: PaidStatus;
  hasComprovante: boolean;
  admin: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [markOpen, setMarkOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  function confirmar() {
    startTransition(async () => {
      const r = await confirmMemberPaymentAction(showId, memberId);
      if (r?.error) toast.error(r.error);
      else toast.success("Recebimento confirmado. 🤘");
    });
  }
  function naoRecebi() {
    if (!confirm("Informar que você NÃO recebeu este pagamento?")) return;
    startTransition(async () => {
      const r = await reportNotReceivedAction(showId, memberId);
      if (r?.error) toast.error(r.error);
      else toast.success("Avisamos o admin que não foi recebido.");
    });
  }
  function desfazer() {
    if (!confirm("Desfazer a marcação de pago?")) return;
    startTransition(async () => {
      await unmarkMemberPaidAction(showId, memberId);
    });
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {status === "none" ? (
        admin ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMarkOpen(true)}
            disabled={pending}
          >
            <Paperclip className="size-3.5" />
            Marcar pago
          </Button>
        ) : (
          <Badge tone="zinc">Pendente</Badge>
        )
      ) : status === "aguardando" ? (
        <>
          <Badge tone="amber">
            <Clock className="size-3" />
            Aguardando
          </Badge>
          {hasComprovante && (admin || isSelf) && (
            <IconBtn title="Ver comprovante" onClick={() => setViewOpen(true)}>
              <Eye className="size-3.5" />
            </IconBtn>
          )}
          {isSelf ? (
            <>
              <Button size="sm" onClick={confirmar} disabled={pending}>
                <Check className="size-3.5" />
                Confirmar
              </Button>
              <IconBtn title="Não recebi" onClick={naoRecebi} danger>
                <X className="size-3.5" />
              </IconBtn>
            </>
          ) : (
            admin && (
              <IconBtn title="Desfazer" onClick={desfazer}>
                <RotateCcw className="size-3.5" />
              </IconBtn>
            )
          )}
        </>
      ) : (
        <>
          <Badge tone="emerald">
            <Check className="size-3" />
            Confirmado
          </Badge>
          {hasComprovante && (admin || isSelf) && (
            <IconBtn title="Ver comprovante" onClick={() => setViewOpen(true)}>
              <Eye className="size-3.5" />
            </IconBtn>
          )}
          {admin && (
            <IconBtn title="Desfazer" onClick={desfazer}>
              <RotateCcw className="size-3.5" />
            </IconBtn>
          )}
        </>
      )}

      {markOpen && (
        <MarkPaidDialog
          showId={showId}
          memberId={memberId}
          memberNome={memberNome}
          open={markOpen}
          onOpenChange={setMarkOpen}
        />
      )}
      {viewOpen && (
        <CacheComprovanteViewer
          showId={showId}
          memberId={memberId}
          open={viewOpen}
          onOpenChange={setViewOpen}
        />
      )}
    </div>
  );
}

export function MarkPaidDialog({
  showId,
  memberId,
  memberNome,
  open,
  onOpenChange,
}: {
  showId: string;
  memberId: string;
  memberNome: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDataUrl(file);
      setDataUrl(url);
      setFileName(file.name);
    } catch {
      toast.error("Não consegui ler o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!dataUrl) return;
    startTransition(async () => {
      const r = await markMemberPaidAction(showId, memberId, dataUrl);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Pagamento de ${memberNome} registrado. Avisamos o músico.`);
      onOpenChange(false);
    });
  }

  const isPdf = dataUrl?.startsWith("data:application/pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento — {memberNome}</DialogTitle>
          <DialogDescription>
            Anexe o comprovante (obrigatório). Foto ou PDF. O músico recebe um
            aviso pra confirmar o recebimento.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground hover:bg-muted/40">
          <Paperclip className="size-4" />
          {busy ? "Processando..." : "Escolher comprovante"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onPick}
          />
        </label>

        {dataUrl &&
          (isPdf ? (
            <p className="text-sm text-emerald-300 flex items-center gap-1.5">
              <Check className="size-4" /> {fileName || "PDF anexado"}
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="Comprovante"
              className="max-h-48 w-full rounded-md object-contain border border-border"
            />
          ))}

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!dataUrl || pending || busy}>
            {pending ? "Salvando..." : "Confirmar pagamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CacheComprovanteViewer({
  showId,
  memberId,
  open,
  onOpenChange,
}: {
  showId: string;
  memberId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getComprovanteAction(showId, memberId).then((r) => {
      if (!active) return;
      setUrl(r.url);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [showId, memberId]);

  const isPdf = url?.startsWith("data:application/pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprovante de pagamento</DialogTitle>
          <DialogDescription>Anexado pelo admin no repasse.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Carregando...
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

function Badge({
  tone,
  children,
}: {
  tone: "zinc" | "amber" | "emerald";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        tone === "emerald" &&
          "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
        tone === "amber" && "bg-amber-500/15 text-amber-300 ring-amber-500/40",
        tone === "zinc" && "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30"
      )}
    >
      {children}
    </span>
  );
}

function IconBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50",
        danger && "hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}
