"use client";

import { useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncAllLyricsAction } from "@/app/(app)/repertorio/actions";

/** "Sincronizar letras" — busca em lote as letras que faltam no repertório. */
export function SyncLyricsButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncAllLyricsAction();
          if (!r.ok) {
            toast.error("Erro ao sincronizar letras.");
            return;
          }
          const parts: string[] = [];
          if (r.fetched) parts.push(`${r.fetched} nova(s)`);
          if (r.alreadyHad) parts.push(`${r.alreadyHad} já tinham`);
          if (r.notFound) parts.push(`${r.notFound} não achada(s)`);
          toast.success(`Letras — ${parts.join(" • ") || "nada a fazer"}.`);
        })
      }
      title="Buscar as letras que faltam de todo o repertório"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      {pending ? "Sincronizando…" : "Sincronizar letras"}
    </Button>
  );
}
