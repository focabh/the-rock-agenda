"use client";

import { useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { enrichSongsAIAction } from "@/app/(app)/repertorio/actions";

/** Preenche energia/conhecida/momento das músicas que faltam, via IA. */
export function EnrichSongsButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await enrichSongsAIAction();
          if (!r.ok) {
            toast[r.needsKey ? "info" : "error"](r.error ?? "Erro.");
            return;
          }
          if ((r.total ?? 0) === 0) {
            toast.info("Todas as músicas já têm detalhes.");
            return;
          }
          toast.success(
            `Detalhes preenchidos em ${r.updated} de ${r.total} música(s). Revise se quiser.`
          );
        })
      }
      title="Inferir energia / conhecida / melhor momento das músicas (IA)"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {pending ? "Preenchendo…" : "Detalhes com IA"}
    </Button>
  );
}
