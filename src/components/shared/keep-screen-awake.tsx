"use client";

import { useEffect } from "react";

/**
 * Mantém a tela do celular/tablet ACESA enquanto o app está aberto (Screen Wake
 * Lock API). Re-adquire ao voltar pra aba (o lock cai quando a tela apaga ou a
 * aba perde foco). Silencioso onde não há suporte (iOS < 16.4, etc.).
 */
export function KeepScreenAwake() {
  useEffect(() => {
    type Sentinel = { release?: () => Promise<void>; addEventListener?: (e: string, cb: () => void) => void };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<Sentinel> };
    };
    let lock: Sentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (cancelled || document.visibilityState !== "visible" || !nav.wakeLock) return;
      try {
        lock = await nav.wakeLock.request("screen");
        lock.addEventListener?.("release", () => {
          lock = null;
        });
      } catch {
        /* sem suporte / negado — ignora */
      }
    };
    request();

    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, []);

  return null;
}
