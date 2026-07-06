"use client";

import { useCallback } from "react";
import { Teleprompter } from "@/components/shared/teleprompter";
import {
  getShowLiveAction,
  setCurrentSongLiveAction,
} from "@/app/(app)/modo-show/live-actions";

type TeleSong = React.ComponentProps<typeof Teleprompter>["songs"][number];

/**
 * Teleprompter LIGADO ao controle colaborativo do show (§10–17). Segue a
 * "música atual" compartilhada (polling) e, quando o vocalista navega, define
 * essa música pra toda a banda. Wrapper fino: mantém o Teleprompter genérico.
 */
export function LiveTeleprompter({
  showId,
  songs,
  defaultTom,
  label,
}: {
  showId: string;
  songs: TeleSong[];
  defaultTom: string | null;
  label?: string;
}) {
  const pollCurrentSongId = useCallback(async () => {
    const s = await getShowLiveAction(showId);
    return s.currentSongId;
  }, [showId]);

  const onSongChange = useCallback(
    (songId: string) => {
      // Não bloqueia a navegação; erro de permissão é silencioso aqui (o
      // controle principal fica no setlist ao vivo, que dá o toast).
      void setCurrentSongLiveAction(showId, songId);
    },
    [showId]
  );

  return (
    <Teleprompter
      songs={songs}
      defaultTom={defaultTom}
      label={label}
      pollCurrentSongId={pollCurrentSongId}
      onSongChange={onSongChange}
    />
  );
}
