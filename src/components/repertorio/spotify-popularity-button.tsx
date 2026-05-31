"use client";

import { useTransition } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncSpotifyPopularityAction } from "@/app/(app)/repertorio/actions";

/** Atualiza a popularidade (Spotify) das músicas — desempata o setlist. R$0 de IA. */
export function SpotifyPopularityButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncSpotifyPopularityAction();
          if (!r.ok) {
            toast.error(r.error ?? "Erro.");
            return;
          }
          toast.success(
            `Popularidade atualizada em ${r.updated} de ${r.total} música(s).`
          );
        })
      }
      title="Buscar a popularidade atual de cada música no Spotify (sem custo de IA)"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <TrendingUp className="size-4" />
      )}
      {pending ? "Atualizando…" : "Popularidade"}
    </Button>
  );
}
