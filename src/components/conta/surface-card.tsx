"use client";

import { useState, useTransition } from "react";
import { Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setSurfaceOpacityAction } from "@/app/(app)/conta/actions";
import { toast } from "sonner";

const PRESETS = [
  { label: "Sólido", value: 100 },
  { label: "Leve", value: 92 },
  { label: "Médio", value: 82 },
  { label: "Vidro", value: 70 },
];

/** Transparência dos blocos/cards (efeito vidro), pra o fundo do app vazar. */
export function SurfaceCard({ initial }: { initial: number }) {
  const [val, setVal] = useState(initial);
  const [pending, start] = useTransition();

  function pick(v: number) {
    setVal(v);
    start(async () => {
      const r = await setSurfaceOpacityAction(v);
      if (r.ok) toast.success("Transparência atualizada.");
    });
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-sky-500/10 ring-1 ring-sky-500/20 shrink-0">
            <Layers className="size-4 text-sky-400" />
          </div>
          <div>
            <h3 className="font-semibold">Transparência dos blocos</h3>
            <p className="text-sm text-muted-foreground">
              Deixa os cards semitransparentes (efeito vidro) pra a imagem de fundo
              aparecer atrás. Só tem efeito com um fundo do app definido.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => pick(p.value)}
              disabled={pending}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
                val === p.value
                  ? "bg-primary/20 text-primary-foreground ring-primary/40"
                  : "text-muted-foreground ring-border hover:bg-accent/50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
