"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncRepertorioFromSpotifyAction } from "@/app/(app)/repertorio/actions";

/**
 * Sincroniza o repertório COM a playlist configurada do Spotify (direção que o
 * Spotify permite — ler playlist pública). Roda automático 1x por sessão ao
 * abrir o Repertório (silencioso, só avisa se trouxe música nova) e tem o botão
 * pra forçar na hora. Só adiciona/atualiza — nunca remove.
 */
export function SpotifySyncButton({ hasPlaylist }: { hasPlaylist: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const auto = useRef(false);

  // Auto-sync oportunista: 1x por sessão, silencioso (igual ReminderPinger).
  useEffect(() => {
    if (!hasPlaylist || auto.current) return;
    auto.current = true;
    if (sessionStorage.getItem("spotify-sync") === "1") return;
    sessionStorage.setItem("spotify-sync", "1");
    syncRepertorioFromSpotifyAction()
      .then((r) => {
        if (r.ok && (r.added ?? 0) > 0) {
          toast.success(
            `${r.added} música(s) nova(s) sincronizada(s) do Spotify.`
          );
          router.refresh();
        }
      })
      .catch(() => {});
  }, [hasPlaylist, router]);

  async function run() {
    if (loading) return;
    setLoading(true);
    try {
      const r = await syncRepertorioFromSpotifyAction();
      if (!r.ok) {
        toast.error(r.error ?? "Não consegui sincronizar.", { duration: 9000 });
        return;
      }
      if ((r.added ?? 0) > 0) {
        toast.success(
          `${r.added} nova(s) adicionada(s)${
            r.existing ? ` · ${r.existing} já tinha(m)` : ""
          }.`
        );
        router.refresh();
      } else {
        toast.success("Repertório já está em dia com a playlist.");
      }
    } catch {
      toast.error("Falha ao sincronizar com o Spotify.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={run}
      disabled={loading}
      title="Puxar músicas novas da playlist configurada do Spotify (Conta › Listas)"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      Sincronizar Spotify
    </Button>
  );
}
