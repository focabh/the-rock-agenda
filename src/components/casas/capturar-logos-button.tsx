"use client";

import { useTransition } from "react";
import { AtSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buscarLogosCasasAction } from "@/app/(app)/casas/actions";

export function CapturarLogosButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      title="Tenta puxar a logo do Instagram das casas que têm @ e ainda não têm logo"
      onClick={() =>
        start(async () => {
          const r = await buscarLogosCasasAction();
          if (r.tentadas === 0) {
            toast.info("Nenhuma casa com @ (e sem logo) pra buscar.");
          } else {
            toast.success(
              `${r.ok} de ${r.tentadas} logos capturadas.` +
                (r.restantes > 0 ? ` Faltam ${r.restantes} — rode de novo.` : "")
            );
          }
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <AtSign className="size-4" />}
      Capturar logos (IG)
    </Button>
  );
}
