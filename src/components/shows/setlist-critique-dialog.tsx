"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  critiqueSetlistAction,
  reorganizeSetlistAction,
  type CritiqueResult,
} from "@/app/(app)/shows/[id]/actions-setlist";
import { reorganizeEnsaioSetlistAction } from "@/app/(app)/ensaios/[id]/actions-setlist";

const VEREDITO = {
  forte: { label: "Curva forte", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  ok: { label: "Ok, dá pra ajustar", cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  fraco: { label: "Curva fraca", cls: "bg-red-500/15 text-red-300 ring-red-500/30" },
} as const;

export function SetlistCritiqueDialog({
  showId,
  rehearsalId,
  setlistId,
  canEdit = false,
}: {
  showId?: string;
  rehearsalId?: string;
  setlistId: string;
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, start] = useTransition();
  const [applying, startApply] = useTransition();
  const [result, setResult] = useState<CritiqueResult | null>(null);

  useEffect(() => {
    if (!open) {
      setResult(null);
      return;
    }
    start(async () => {
      const r = await critiqueSetlistAction(setlistId);
      setResult(r);
    });
  }, [open, setlistId]);

  function aplicar() {
    startApply(async () => {
      const r = rehearsalId
        ? await reorganizeEnsaioSetlistAction(rehearsalId, setlistId)
        : await reorganizeSetlistAction(showId!, setlistId);
      if (r.ok) {
        toast.success("Setlist reorganizado na curva de energia. 🤘");
        setOpen(false);
      } else {
        toast.error("Não foi possível reorganizar.");
      }
    });
  }

  const v = result?.veredito ? VEREDITO[result.veredito] : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ClipboardCheck className="size-4" />
        Avaliar (IA)
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliação do setlist</DialogTitle>
          <DialogDescription>
            A IA aponta os problemas da curva. Use “Aplicar melhorias” pra
            reorganizar na hora — grátis, sem custo de IA.
          </DialogDescription>
        </DialogHeader>

        {loading && !result ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Avaliando…
          </div>
        ) : result && !result.ok ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {result.needsKey
              ? "IA não configurada (ANTHROPIC_API_KEY)."
              : (result.error ?? "Não foi possível avaliar.")}
          </p>
        ) : result ? (
          <div className="space-y-3">
            {v && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
                  v.cls
                )}
              >
                {v.label}
              </span>
            )}
            {result.alertas && result.alertas.length > 0 ? (
              <ul className="space-y-2">
                {result.alertas.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 className="size-4" />
                Nenhum problema de dinâmica encontrado. 🤘
              </p>
            )}
          </div>
        ) : null}

        {canEdit && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <Button onClick={aplicar} disabled={applying || loading}>
              {applying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {applying ? "Reorganizando…" : "Aplicar melhorias (reorganizar)"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Reordena as mesmas músicas na curva (abre leve → sobe → fecha
              forte → Final Boss no fim). Depois é só arrastar e add/remover.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
