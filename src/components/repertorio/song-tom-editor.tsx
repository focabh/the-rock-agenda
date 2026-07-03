"use client";

import { useState, useTransition } from "react";
import { Loader2, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { NumberStepper } from "@/components/shared/number-stepper";
import { toast } from "sonner";
import { setSongTomAction } from "@/app/(app)/repertorio/actions";

/** Tom (transposição) da música — QUALQUER músico ajusta. Stepper −/+ (sem
 *  digitar sinal, acabou o bug do "--3"). 0 = original (sem badge). Auto-salva. */
export function SongTomEditor({
  songId,
  initial,
}: {
  songId: string;
  initial: string | null;
}) {
  const [tom, setTom] = useState<number>(Number(initial ?? 0) || 0);
  const [saving, start] = useTransition();

  function save(n: number) {
    setTom(n);
    start(async () => {
      const r = await setSongTomAction(songId, n === 0 ? null : String(n));
      if (!r.ok) toast.error("Erro ao salvar o tom.");
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        <ArrowUpDown className="size-3.5" />
        Tom (transposição)
      </h2>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <NumberStepper value={tom} onChange={save} min={-12} max={12} step={1} />
          {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <p className="flex-1 text-xs text-muted-foreground">
            Quanto a banda baixa/sobe vs o original (0 = original, −2 = dois
            semitons abaixo). Use as setinhas — não precisa digitar o sinal.
            Qualquer músico ajusta; aparece grandão na impressão, nas letras e no
            teleprompter.
          </p>
        </div>
      </Card>
    </section>
  );
}
