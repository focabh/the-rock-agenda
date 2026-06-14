"use client";

import { useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { diagnoseSpotifyAction } from "@/app/(app)/repertorio/spotify-actions";

/**
 * Roda o diagnóstico do export Spotify e mostra o veredito (escopo salvo, conta
 * real, email exato e o erro 403 verdadeiro). Superusuário.
 */
export function SpotifyDiagnoseButton() {
  const [loading, setLoading] = useState(false);

  async function run() {
    if (loading) return;
    setLoading(true);
    try {
      const d = await diagnoseSpotifyAction();
      // Detalhe completo no console pra depuração profunda.
      console.info("[Spotify diagnóstico]", d);
      const ok = d.createTest?.ok;
      toast[ok ? "success" : "error"](d.verdict, {
        duration: 30000,
        description: d.account?.email
          ? `Conta: ${d.account.email} · ${d.account.product ?? "?"}`
          : undefined,
        action: d.account?.email
          ? {
              label: "Copiar email",
              onClick: () =>
                navigator.clipboard?.writeText(d.account!.email!),
            }
          : undefined,
      });
    } catch {
      toast.error("Falha ao rodar o diagnóstico do Spotify.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={run}
      disabled={loading}
      title="Diagnosticar por que o export pro Spotify falha (escopo, conta, erro real)"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Stethoscope className="size-4" />
      )}
      Diagnóstico
    </Button>
  );
}
