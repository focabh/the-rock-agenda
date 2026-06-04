"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MetronomeIcon } from "@/components/shared/metronome-icon";
import { fetchBpmAllAction, fetchBpmOriginalAction } from "@/app/(app)/repertorio/actions";

type Miss = { id: string; titulo: string; artista: string };

export function BpmFetchButton() {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [faltando, setFaltando] = useState<Miss[]>([]);

  function buscar() {
    start(async () => {
      const r = await fetchBpmAllAction();
      toast.success(
        r.atualizadas > 0 ? `BPM preenchido em ${r.atualizadas} música(s).` : "Nada novo pra preencher."
      );
      if (r.faltando.length > 0) {
        setFaltando(r.faltando);
        setOpen(true);
      } else {
        setOpen(false);
      }
    });
  }

  function puxarOriginal() {
    start(async () => {
      const r = await fetchBpmOriginalAction(faltando.map((m) => m.id));
      toast.success(
        r.atualizadas > 0 ? `Mais ${r.atualizadas} pela versão original.` : "Não achei nem pela original."
      );
      setFaltando(r.faltando);
      if (r.faltando.length === 0) setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={buscar} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MetronomeIcon className="size-4" />}
        Buscar BPM
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Músicas sem BPM ({faltando.length})</DialogTitle>
            <DialogDescription>
              Não achei o BPM destas — provavelmente porque são <strong>covers</strong> (o artista cadastrado não é o da
              gravação original). Quer tentar pela <strong>versão original</strong> (busca só pelo título)?
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg bg-muted/30">
            {faltando.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{m.titulo}</span>
                <span className="shrink-0 truncate text-xs text-muted-foreground">{m.artista}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Deixar pra lá</Button>
            <Button onClick={puxarOriginal} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Puxar da original
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O que continuar sem BPM, é só bater no Tap dentro do metrônomo da música.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
