"use client";

import { useState, useTransition } from "react";
import { Loader2, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { setSongTomAction } from "@/app/(app)/repertorio/actions";

/** Tom (transposição) da música — QUALQUER músico pode ajustar. Auto-salva. */
export function SongTomEditor({
  songId,
  initial,
}: {
  songId: string;
  initial: string | null;
}) {
  const [tom, setTom] = useState(initial ?? "");
  const [saving, start] = useTransition();

  function save() {
    start(async () => {
      const r = await setSongTomAction(songId, tom.trim() || null);
      if (r.ok) toast.success("Tom salvo.");
      else toast.error("Erro ao salvar o tom.");
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
          <Input
            value={tom}
            inputMode="numeric"
            onChange={(e) => setTom(e.target.value)}
            onBlur={save}
            placeholder="0, -1, -2, -3"
            className="w-24 text-center text-lg font-bold"
          />
          {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <p className="flex-1 text-xs text-muted-foreground">
            Quanto a banda baixa/sobe vs o original (0 = original, -2 = dois
            semitons abaixo). Qualquer músico ajusta — aparece grandão na
            impressão, nas letras e no teleprompter.
          </p>
        </div>
      </Card>
    </section>
  );
}
