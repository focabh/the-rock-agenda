"use client";

import { useEffect, useState } from "react";
import { QrCode, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { gerarPixCopiaECola, type PixTipo } from "@/lib/pix";
import { formatBRL } from "@/lib/formatters";

/** Botão "Pix": gera o Copia-e-Cola + QR da cota do músico pra pagar no banco.
 *  Sem API/custo — é só o BR Code. Depois o admin anexa o comprovante. */
export function PixButton({
  nome,
  chave,
  tipo,
  valorCentavos,
}: {
  nome: string;
  chave: string;
  tipo: PixTipo;
  valorCentavos: number;
}) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const payload = gerarPixCopiaECola({ chave, tipo, nome, valorCentavos });

  useEffect(() => {
    if (!open) return;
    setQr(null);
    import("qrcode")
      .then((Q) => Q.toDataURL(payload, { margin: 1, width: 320 }))
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, payload]);

  function copiar() {
    navigator.clipboard
      ?.writeText(payload)
      .then(() => {
        setCopiado(true);
        toast.success("Código Pix copiado — cole no seu banco.");
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => toast.error("Não consegui copiar."));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-teal-400 transition-colors hover:bg-teal-500/15"
        title="Pagar via Pix (gera QR / copia-e-cola)"
      >
        <QrCode className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar {nome} via Pix</DialogTitle>
            <DialogDescription>
              {valorCentavos > 0 ? `${formatBRL(valorCentavos)} · ` : ""}escaneie o QR ou copie o código no seu banco. Depois marque como pago e anexe o comprovante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR Pix" className="size-56 rounded-xl bg-white p-2" />
              ) : (
                <div className="flex size-56 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
                  gerando QR…
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Pix copia e cola</p>
              <p className="max-h-24 overflow-y-auto break-all font-mono text-xs">{payload}</p>
            </div>
            <Button onClick={copiar} className="w-full">
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado!" : "Copiar código Pix"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Confere a chave/valor no app do banco antes de confirmar.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
