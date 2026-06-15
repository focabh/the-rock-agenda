"use client";

import { useState } from "react";
import { Loader2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  repertorioSpotifyLinksAction,
  setlistSpotifyLinksAction,
} from "@/app/(app)/repertorio/spotify-actions";

/**
 * Copia os links das faixas pro Spotify. O Spotify bloqueou criar playlist via
 * API em Development Mode (restrição deles desde mai/2025), e o Extended Quota
 * Mode só é dado a organizações com 250k+ usuários — inviável pra banda. Então,
 * em vez de criar a playlist, copiamos a lista pra colar num importador grátis
 * (Soundiiz/TuneMyMusic), que cria a playlist em segundos.
 */
export function SpotifyExportButton({
  mode,
  setlistId,
  label,
  size = "sm",
}: {
  mode: "repertorio" | "setlist";
  setlistId?: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const [loading, setLoading] = useState(false);

  async function run() {
    if (loading) return;
    setLoading(true);
    try {
      const r =
        mode === "repertorio"
          ? await repertorioSpotifyLinksAction()
          : await setlistSpotifyLinksAction(setlistId ?? "");
      if (!r.ok) {
        toast.error(r.error, { duration: 8000 });
        return;
      }
      const text = r.links.join("\n");
      let copiado = false;
      try {
        await navigator.clipboard.writeText(text);
        copiado = true;
      } catch {
        // Sem permissão de clipboard (Safari/contexto) — cai no prompt manual.
        window.prompt("Copie a lista (Ctrl+C / Cmd+C):", text);
      }
      toast.success(
        `${r.count} faixa(s) ${copiado ? "copiada(s)" : "prontas"}! ` +
          `O Spotify não deixa criar playlist por app — cole no Soundiiz pra virar playlist.`,
        {
          duration: 15000,
          action: {
            label: "Abrir Soundiiz",
            onClick: () => window.open("https://soundiiz.com/", "_blank"),
          },
        }
      );
    } catch {
      toast.error("Falha ao preparar a lista pro Spotify.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={run}
      disabled={loading}
      title="Copiar os links das faixas pra colar num importador (Soundiiz) e criar a playlist"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ListPlus className="size-4" />
      )}
      {label ?? "Copiar pro Spotify"}
    </Button>
  );
}
