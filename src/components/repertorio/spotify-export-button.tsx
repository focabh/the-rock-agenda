"use client";

import { useState } from "react";
import { Loader2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  exportRepertorioToSpotifyAction,
  exportSetlistToSpotifyAction,
} from "@/app/(app)/repertorio/spotify-actions";

/** Exporta o repertório (ou um setlist) pro Spotify como playlist pública. */
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
          ? await exportRepertorioToSpotifyAction()
          : await exportSetlistToSpotifyAction(setlistId ?? "");
      if (r.ok) {
        toast.success(`Playlist criada (${r.count} faixa(s))! Abrindo no Spotify…`);
        window.open(r.url, "_blank");
      } else {
        toast.error(r.error);
      }
    } catch {
      toast.error("Falha ao exportar pro Spotify.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size={size} onClick={run} disabled={loading} title="Criar uma playlist pública no Spotify com estas músicas">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <ListPlus className="size-4" />}
      {label ?? "Exportar pro Spotify"}
    </Button>
  );
}
