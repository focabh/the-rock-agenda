"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { setAdminMaterialPorPosicaoAction } from "@/app/(app)/conta/actions";

export function MaterialPrefToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  function toggle(value: boolean) {
    setOn(value);
    start(async () => {
      const r = await setAdminMaterialPorPosicaoAction(value);
      if (!r.ok) {
        setOn(!value);
        toast.error("Não foi possível salvar.");
      } else {
        toast.success("Preferência salva.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="py-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={on}
            disabled={pending}
            onChange={(e) => toggle(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="text-sm">
            <span className="font-medium">
              Admin também vê só o material da sua posição
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Ligado: ao assumir uma posição (ex.: baterista), você vê só o
              material dela — letras ficam escondidas pra instrumentista.
              Desligado (padrão): como admin, você sempre vê as letras pra
              gerenciar/sincronizar.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
