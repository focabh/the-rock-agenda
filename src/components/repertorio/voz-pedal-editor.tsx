"use client";

import { useState, useTransition } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { setSongVozPedalPresetAction } from "@/app/(app)/repertorio/actions";

type Preset = { id: string; nome: string; slot: string; desc: string };

/** Seletor do preset do pedal de voz por música (auto-salva — mexe o mínimo). */
export function VozPedalEditor({
  songId,
  modeloNome,
  presets,
  initialPresetId,
}: {
  songId: string;
  modeloNome: string;
  presets: Preset[];
  initialPresetId: string | null;
}) {
  const [presetId, setPresetId] = useState(initialPresetId ?? "");
  const [saving, start] = useTransition();

  function change(id: string) {
    setPresetId(id);
    start(async () => {
      const r = await setSongVozPedalPresetAction(songId, id || null);
      if (!r.ok) toast.error("Erro ao salvar o preset.");
      else toast.success("Preset salvo.");
    });
  }

  const atual = presets.find((p) => p.id === presetId);

  return (
    <section className="space-y-2">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        <SlidersHorizontal className="size-3.5" />
        Pedal de voz {modeloNome ? `· ${modeloNome}` : ""}
      </h2>
      <Card className="p-4">
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedal de voz configurado. Escolha o modelo em Conta › Equipamento
            de voz.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={presetId}
              onChange={(e) => change(e.target.value)}
              disabled={saving}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— sem preset —</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.slot})
                </option>
              ))}
            </select>
            {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {atual && (
              <span className="text-xs text-muted-foreground">{atual.desc}</span>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
