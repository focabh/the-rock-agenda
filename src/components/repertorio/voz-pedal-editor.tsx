"use client";

import { useState, useTransition } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { setSongVozPedalAction } from "@/app/(app)/repertorio/actions";
import { parseVozPedal } from "@/lib/voz-pedal";

/** Editor da config do pedal de voz (Flamma FV-02) por música. */
export function VozPedalEditor({
  songId,
  initial,
}: {
  songId: string;
  initial: string | null;
}) {
  const p = parseVozPedal(initial);
  const [mode, setMode] = useState(p?.mode ?? "");
  const [reverb, setReverb] = useState(p?.reverb ?? "");
  const [level, setLevel] = useState<string>(p ? String(p.level) : "");
  const [saving, start] = useTransition();

  function save(clear = false) {
    start(async () => {
      const r = await setSongVozPedalAction(
        songId,
        clear || !mode.trim()
          ? null
          : { mode: mode.trim(), reverb: reverb.trim(), level: Number(level) || 0 }
      );
      if (!r.ok) {
        toast.error("Erro ao salvar a config do pedal.");
        return;
      }
      if (clear) {
        setMode("");
        setReverb("");
        setLevel("");
        toast.success("Config do pedal removida.");
      } else {
        toast.success("Config do pedal salva.");
      }
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        <SlidersHorizontal className="size-3.5" />
        Pedal de voz
      </h2>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="vp-mode" className="text-xs">
              Mode
            </Label>
            <Input
              id="vp-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              placeholder="1 / OFF"
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vp-reverb" className="text-xs">
              Reverb
            </Label>
            <Input
              id="vp-reverb"
              value={reverb}
              onChange={(e) => setReverb(e.target.value)}
              placeholder="RM"
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vp-level" className="text-xs">
              Level (%)
            </Label>
            <Input
              id="vp-level"
              type="number"
              min={0}
              max={100}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="20"
              className="w-24"
            />
          </div>
          <Button onClick={() => save(false)} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
          {(mode || reverb || level) && (
            <Button variant="ghost" onClick={() => save(true)} disabled={saving}>
              Limpar
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Aparece na música no setlist, teleprompter e modo show. Use{" "}
          <strong>OFF</strong> no Mode pra marcar pedal desligado.
        </p>
      </Card>
    </section>
  );
}
