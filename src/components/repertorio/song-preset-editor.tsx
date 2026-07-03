"use client";

import { useState, useTransition } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { NumberStepper } from "@/components/shared/number-stepper";
import { toast } from "sonner";
import { setSongPresetAction } from "@/app/(app)/repertorio/actions";

/** Stage Master — preset do pedal de voz (número) da música. Stepper −/+,
 *  colaborativo (qualquer músico), auto-salva. 0/vazio = sem preset. */
export function SongPresetEditor({
  songId,
  initial,
}: {
  songId: string;
  initial: number | null;
}) {
  const [preset, setPreset] = useState<number>(initial ?? 0);
  const [saving, start] = useTransition();

  function save(n: number) {
    setPreset(n);
    start(async () => {
      const r = await setSongPresetAction(songId, n > 0 ? n : null);
      if (!r.ok) toast.error("Erro ao salvar o preset.");
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        <SlidersHorizontal className="size-3.5" />
        Preset do pedal de voz
      </h2>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <NumberStepper
            value={preset}
            onChange={save}
            min={0}
            max={9999}
            step={1}
          />
          {preset > 0 && (
            <button
              type="button"
              onClick={() => save(0)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Limpar preset"
            >
              <X className="size-3.5" /> limpar
            </button>
          )}
          {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <p className="flex-1 text-xs text-muted-foreground">
            O número do preset no seu equipamento de voz. Qualquer músico ajusta —
            aparece em destaque no teleprompter, nas letras, no repertório e no
            setlist. 0 = sem preset.
          </p>
        </div>
      </Card>
    </section>
  );
}
