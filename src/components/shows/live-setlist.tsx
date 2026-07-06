"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Music2, Radio, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PresetBadge } from "@/components/shared/preset-badge";
import { tomBadgeClass } from "@/lib/tom";
import {
  getShowLiveAction,
  setCurrentSongLiveAction,
  setShowControlModeAction,
} from "@/app/(app)/modo-show/live-actions";
import type { ShowLiveState } from "@/lib/show-live";

export type LiveItem = {
  id: string;
  songId: string;
  n: number;
  titulo: string;
  artista: string;
  tom: string | null;
  dropada: boolean;
  vozPreset: number | null;
  vozCueInicial: string | null;
};

const POLL_MS = 2500;

/**
 * §10–17 (Bloco A): setlist com controle colaborativo em tempo real via polling.
 * Estado ÚNICO no servidor (show_live). Qualquer dispositivo autorizado define a
 * "Música atual"; todos os outros refletem em ~2,5s. Notifica quem alterou.
 */
export function LiveSetlist({
  showId,
  items,
  initial,
  isHost,
  memberId,
  memberName,
  defaultTom,
}: {
  showId: string;
  items: LiveItem[];
  initial: ShowLiveState;
  isHost: boolean;
  memberId: string | null;
  memberName: string | null;
  defaultTom: string | null;
}) {
  const [live, setLive] = useState<ShowLiveState>(initial);
  const [, startTransition] = useTransition();
  const lastVersion = useRef(initial.version);
  const justActed = useRef(false);

  const canControl =
    isHost || live.controlMode === "all" || (live.controlMode === "host_members" && !!memberId);

  // Aplica um novo estado + avisa quando a mudança veio de OUTRA pessoa (§13).
  function apply(next: ShowLiveState) {
    if (next.version > lastVersion.current) {
      const mine = justActed.current || (next.updatedByName && next.updatedByName === memberName);
      if (!mine && next.updatedByName) {
        toast(`Música alterada por ${next.updatedByName}`, { icon: "🎶" });
      }
      justActed.current = false;
    }
    lastVersion.current = next.version;
    setLive(next);
  }

  // Polling: mantém todos os dispositivos sincronizados. Também repolla ao voltar
  // o foco (reconexão §17).
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await getShowLiveAction(showId);
        if (alive) apply(s);
      } catch {
        /* offline — segue com o último estado conhecido */
      }
    };
    const id = window.setInterval(poll, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    poll();
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId]);

  function selectSong(songId: string) {
    if (!canControl) {
      toast.error("Você não tem permissão pra controlar o show.");
      return;
    }
    justActed.current = true;
    // Otimista: reflete já; o servidor confirma no próximo estado.
    setLive((l) => ({ ...l, currentSongId: songId }));
    startTransition(async () => {
      const r = await setCurrentSongLiveAction(showId, songId);
      if (!r.ok || !r.state) {
        justActed.current = false;
        toast.error(r.error ?? "Não foi possível trocar a música.");
        // recarrega o estado real
        getShowLiveAction(showId).then((s) => setLive(s)).catch(() => {});
        return;
      }
      apply(r.state);
    });
  }

  function changeMode(mode: ShowLiveState["controlMode"]) {
    justActed.current = true;
    startTransition(async () => {
      const r = await setShowControlModeAction(showId, mode);
      if (r.ok && r.state) apply(r.state);
      else toast.error(r.error ?? "Sem permissão.");
    });
  }

  const MODE_LABEL: Record<ShowLiveState["controlMode"], string> = {
    host: "Somente host",
    host_members: "Host + integrantes",
    all: "Todos",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Music2 className="size-4 text-primary" /> Setlist ({items.length})
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Radio className="size-3.5" />
          {live.maestroName ? `Maestro: ${live.maestroName}` : "Show ao vivo"}
        </span>
      </div>

      {isHost && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Quem controla:</span>
          {(["host", "host_members", "all"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => changeMode(m)}
              className={`rounded-full px-2.5 py-1 font-medium ring-1 ring-inset transition-colors ${
                live.controlMode === m
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "text-muted-foreground ring-border hover:text-foreground"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      )}

      {!canControl && (
        <p className="text-xs text-muted-foreground">
          Modo <strong>{MODE_LABEL[live.controlMode]}</strong> — você acompanha o show em tempo real.
        </p>
      )}

      <ol className="space-y-1.5">
        {items.map((it) => {
          const isCurrent = live.currentSongId === it.songId;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => selectSong(it.songId)}
                disabled={!canControl}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                  isCurrent
                    ? "bg-primary/15 ring-1 ring-inset ring-primary/40"
                    : canControl
                      ? "hover:bg-accent"
                      : "cursor-default"
                }`}
              >
                <span className="w-6 shrink-0 text-right font-mono text-muted-foreground">{it.n}.</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 wrap-break-word font-medium leading-snug">
                    {it.titulo}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{it.artista}</span>
                </span>
                {isCurrent && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    <CheckCircle2 className="size-3" /> ATUAL
                  </span>
                )}
                {it.dropada && (
                  <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
                    DROP
                  </span>
                )}
                <PresetBadge preset={it.vozPreset} className="text-[10px]" />
                {it.tom && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold ring-1 ring-inset ${tomBadgeClass(it.tom, defaultTom, "app")}`}
                  >
                    {it.tom}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
