"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sugerirPresetsPedalAction } from "@/app/(app)/repertorio/actions";

/** IA mapeia o repertório pros presets do pedal de voz (1 chamada, barato). */
export function VozPresetsButton() {
  const router = useRouter();
  const [loading, start] = useTransition();

  function run() {
    if (loading) return;
    start(async () => {
      const r = await sugerirPresetsPedalAction();
      if (!r.ok) {
        toast.error(
          r.needsKey
            ? "IA não configurada (ANTHROPIC_API_KEY)."
            : (r.error ?? "Não consegui sugerir os presets.")
        );
        return;
      }
      toast.success(
        `Presets do pedal sugeridos pra ${r.applied} música(s) (${r.modeloNome}). Revise as exceções.`
      );
      router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={run}
      disabled={loading}
      title="A IA escolhe o preset do pedal de voz pra cada música (maioria = universal)"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <SlidersHorizontal className="size-4" />
      )}
      Presets de voz (IA)
    </Button>
  );
}
