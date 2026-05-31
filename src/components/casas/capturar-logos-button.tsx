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
            toast.info("Todas as casas já têm logo. 🎉");
          } else {
            toast.success(
              `${r.ok} logo(s) capturada(s) de ${r.tentadas} casa(s)` +
                (r.achouArroba > 0 ? ` · ${r.achouArroba} @ achados no Google` : "") +
                (r.restantes > 0 ? `. Faltam ${r.restantes} — rode de novo.` : ".")
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
