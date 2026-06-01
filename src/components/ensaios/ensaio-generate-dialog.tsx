"use client";

import { useState, useTransition } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { gerarEnsaioSetlistAction } from "@/app/(app)/ensaios/[id]/actions-setlist";

/** "Gerar" do ensaio — versão simplificada (sem casa/público): monta a ordem
 *  por curva de energia até um alvo de tempo. */
export function EnsaioGenerateDialog({
  rehearsalId,
  setlistId,
  hasItems,
}: {
  rehearsalId: string;
  setlistId: string;
  hasItems: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(60);
  const [conhecidas, setConhecidas] = useState(true);
  const [pesadas, setPesadas] = useState(false);
  const [levesComeco, setLevesComeco] = useState(true);
  const [pending, start] = useTransition();

  function gerar() {
    start(async () => {
      const r = await gerarEnsaioSetlistAction(rehearsalId, setlistId, {
        targetMin: min,
        priConhecidas: conhecidas,
        priPesadas: pesadas,
        levesNoComeco: levesComeco,
      });
      if (r.ok) {
        toast.success(`Setlist gerado com ${r.count} música(s). Ajuste arrastando.`);
        setOpen(false);
      } else {
        toast.error("Não foi possível gerar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Wand2 className="size-4" /> Gerar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar setlist do ensaio</DialogTitle>
          <DialogDescription>
            Monta a ordem por curva de energia até o tempo-alvo. {hasItems ? "Substitui as músicas atuais." : ""} Grátis, sem IA. Depois é só ajustar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="alvo">Duração-alvo (min)</Label>
            <Input id="alvo" type="number" min={5} max={300} step={5} value={min} onChange={(e) => setMin(Number(e.target.value) || 60)} className="w-28" />
          </div>
          <div className="space-y-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={conhecidas} onChange={(e) => setConhecidas(e.target.checked)} className="size-4 accent-red-600" />
              Priorizar conhecidas
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={pesadas} onChange={(e) => setPesadas(e.target.checked)} className="size-4 accent-red-600" />
              Priorizar pesadas
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={levesComeco} onChange={(e) => setLevesComeco(e.target.checked)} className="size-4 accent-red-600" />
              Começar mais leve
            </label>
          </div>
          <div className="flex justify-end">
            <Button onClick={gerar} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              {pending ? "Gerando…" : "Gerar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
