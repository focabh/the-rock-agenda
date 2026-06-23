"use client";

import { useState, useTransition } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { PEDAL_MODELS } from "@/lib/voz-pedais";
import { setVozPedalModeloAction } from "@/app/(app)/conta/actions";

/** Escolhe o pedal de voz ativo do vocalista + mostra os presets pra programar. */
export function VozPedalConfig({ initial }: { initial: string | null }) {
  const [modelo, setModelo] = useState(initial ?? "");
  const [saving, start] = useTransition();
  const models = Object.values(PEDAL_MODELS);
  const sel = modelo ? PEDAL_MODELS[modelo] : null;

  function change(id: string) {
    setModelo(id);
    start(async () => {
      const r = await setVozPedalModeloAction(id);
      if (r.ok) toast.success("Pedal de voz atualizado.");
      else toast.error("Erro ao salvar.");
    });
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-primary" />
        <h3 className="font-semibold">Equipamento de voz</h3>
        {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-sm text-muted-foreground">
        O pedal que o vocalista usa. Os presets aparecem em cada música (setlist,
        teleprompter, modo show) e a IA mapeia o repertório pra eles.
      </p>

      <select
        value={modelo}
        onChange={(e) => change(e.target.value)}
        disabled={saving}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-xs"
      >
        <option value="">— Nenhum —</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </select>

      {sel && (
        <div className="space-y-1.5 rounded-lg border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Programe estas memórias no {sel.nome}:
          </p>
          <ul className="space-y-1 text-sm">
            {sel.presets.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{p.nome}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {p.slot}
                </span>
                {p.universal && (
                  <span className="text-[10px] font-bold uppercase text-emerald-400">
                    padrão
                  </span>
                )}
                <span className="w-full text-xs text-muted-foreground">{p.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
