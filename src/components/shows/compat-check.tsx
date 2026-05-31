"use client";

import { useState, useTransition } from "react";
import { Loader2, Wrench, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { checkShowCompatAction } from "@/app/(app)/shows/[id]/actions-compat";

export function CompatCheck({ showId }: { showId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [parecer, setParecer] = useState<string | null>(null);

  function run() {
    start(async () => {
      const r = await checkShowCompatAction(showId);
      if (!r.ok) {
        toast[r.needsKey ? "info" : "error"](r.error ?? "Falha.");
        return;
      }
      setParecer(r.parecer ?? "");
    });
  }

  return (
    <Card className="border-zinc-800 bg-[#18181b]">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-100">
            <Wrench className="size-4 text-amber-400" /> Compatibilidade técnica
          </p>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm(true)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Avaliar (IA)"}
          </Button>
        </div>
        {parecer && (
          <p className="flex items-start gap-2 text-sm text-zinc-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <span>{parecer}</span>
          </p>
        )}

        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Avaliar compatibilidade com IA?</AlertDialogTitle>
              <AlertDialogDescription>
                Compara a infraestrutura da banda com a da casa e dá um parecer
                curto de técnico de som. Usa a IA (poucos centavos). Confirmar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel render={<Button variant="outline" />}>Cancelar</AlertDialogCancel>
              <AlertDialogAction render={<Button />} onClick={() => { setConfirm(false); run(); }}>
                Avaliar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
