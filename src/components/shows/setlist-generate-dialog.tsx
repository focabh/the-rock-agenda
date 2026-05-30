"use client";

import { useState, useTransition } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { generateSetlistAction } from "@/app/(app)/shows/[id]/actions-setlist";

type Opts = {
  priConhecidas: boolean;
  priPesadas: boolean;
  priAlternativas: boolean;
  levesNoComeco: boolean;
  evitarVocalDificil: boolean;
  evitarRepetir: boolean;
};

const CHECKS: { key: keyof Opts; label: string }[] = [
  { key: "priConhecidas", label: "Priorizar músicas mais conhecidas" },
  { key: "priPesadas", label: "Priorizar músicas mais pesadas" },
  { key: "priAlternativas", label: "Priorizar mais alternativas" },
  { key: "levesNoComeco", label: "Mais leves no começo" },
  { key: "evitarVocalDificil", label: "Evitar músicas difíceis pro vocal" },
  { key: "evitarRepetir", label: "Evitar repetir setlist anterior nesta casa" },
];

export function SetlistGenerateDialog({
  showId,
  setlistId,
  hasItems,
}: {
  showId: string;
  setlistId: string;
  hasItems: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(60);
  const [ordem, setOrdem] = useState<"equilibrada" | "aleatoria">("equilibrada");
  const [opts, setOpts] = useState<Opts>({
    priConhecidas: false,
    priPesadas: false,
    priAlternativas: false,
    levesNoComeco: false,
    evitarVocalDificil: false,
    evitarRepetir: true,
  });
  const [pending, start] = useTransition();

  function gerar() {
    start(async () => {
      const r = await generateSetlistAction(showId, setlistId, {
        targetMin: min,
        ordem,
        ...opts,
        seed: Math.floor(Math.random() * 1_000_000_000),
      });
      if (!r.ok) {
        toast.error(r.error ?? "Falha ao gerar.");
        return;
      }
      toast.success(
        `Setlist gerado: ${r.count} música(s) (~${Math.round((r.totalSeg ?? 0) / 60)} min). Ajuste à vontade.`
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Wand2 className="size-4" />
        Gerar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar setlist</DialogTitle>
          <DialogDescription>
            Sugestão inicial com base na duração e no perfil da casa.
            {hasItems ? " Substitui o setlist atual." : ""} Você ajusta tudo
            depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gen-min">Duração do show (min)</Label>
              <Input
                id="gen-min"
                type="number"
                min={5}
                max={300}
                value={min}
                onChange={(e) => setMin(Number(e.target.value) || 60)}
                className="w-28"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-ordem">Ordem</Label>
              <select
                id="gen-ordem"
                value={ordem}
                onChange={(e) =>
                  setOrdem(e.target.value as "equilibrada" | "aleatoria")
                }
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="equilibrada">Equilibrada</option>
                <option value="aleatoria">Mais aleatória</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {CHECKS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={opts[c.key]}
                  onChange={(e) =>
                    setOpts((o) => ({ ...o, [c.key]: e.target.checked }))
                  }
                  className="size-4 accent-primary"
                />
                {c.label}
              </label>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            O perfil/tags da casa já influenciam automaticamente (ex.: público
            comercial → mais conhecidas; pesado → mais energia).
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={gerar} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {pending ? "Gerando…" : "Gerar setlist"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
