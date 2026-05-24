"use client";

import { useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Music, Plug, Unplug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  connectSpotifyAction,
  disconnectSpotifyAction,
} from "@/app/(app)/repertorio/spotify-actions";

const CANONICAL_HOST = "127.0.0.1";

export function SpotifyConnect({
  connected,
  ownerName,
}: {
  connected: boolean;
  ownerName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const params = useSearchParams();

  function handleConnect(e: React.FormEvent) {
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== CANONICAL_HOST
    ) {
      e.preventDefault();
      const url = new URL(window.location.href);
      url.hostname = CANONICAL_HOST;
      toast.info(`Redirecionando para ${CANONICAL_HOST}:${url.port}...`);
      window.location.href = url.toString();
    }
  }

  useEffect(() => {
    const status = params.get("spotify");
    if (!status) return;
    if (status === "conectado") toast.success("Spotify conectado!");
    else if (status === "naoconfig")
      toast.error("Faltam credenciais do Spotify no .env.local");
    else if (status === "erro")
      toast.error(`Spotify: ${params.get("motivo") ?? "falha"}`);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("spotify");
      url.searchParams.delete("motivo");
      window.history.replaceState({}, "", url.toString());
    }
  }, [params]);

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-emerald-500/30 bg-emerald-500/15 text-emerald-300"
          title={ownerName ? `Conta: ${ownerName}` : undefined}
        >
          <Music className="size-3" />
          Spotify
          {ownerName && (
            <span className="opacity-75">({ownerName})</span>
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            startTransition(async () => {
              await disconnectSpotifyAction();
              toast.success("Spotify desconectado.");
            })
          }
          disabled={pending}
          title="Desconectar Spotify"
        >
          <Unplug className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <form action={connectSpotifyAction} onSubmit={handleConnect}>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plug className="size-4" />
        )}
        Conectar Spotify
      </Button>
    </form>
  );
}
