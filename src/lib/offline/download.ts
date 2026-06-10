"use client";

import { useOffline } from "./store";

/** Manda o SW pré-cachear uma lista de URLs (usa o handler WARM_CACHE que já
 *  existe no sw.js). Resolve no WARM_CACHE_DONE ou após timeout. */
function warm(urls: string[]): Promise<void> {
  return new Promise((resolve) => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    if (!sw || !sw.controller) {
      resolve();
      return;
    }
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "WARM_CACHE_DONE") {
        sw.removeEventListener("message", onMsg);
        resolve();
      }
    };
    sw.addEventListener("message", onMsg);
    sw.controller.postMessage({ type: "WARM_CACHE", urls });
    // failsafe: não trava a UI se o SW não responder
    setTimeout(() => {
      sw.removeEventListener("message", onMsg);
      resolve();
    }, 60000);
  });
}

/** Baixa TUDO pra offline: snapshot fresco + pré-cache das telas de palco
 *  (repertório, agenda, modo show, e cada show/ensaio futuro + suas letras). */
export async function downloadAllForOffline(): Promise<{ urls: number }> {
  await useOffline.getState().refresh();
  const snap = useOffline.getState().snapshot;

  const urls = new Set<string>([
    "/",
    "/repertorio",
    "/agenda",
    "/shows",
    "/ensaios",
    "/modo-show",
    "/api/offline/snapshot",
  ]);
  if (snap) {
    for (const s of snap.shows) {
      urls.add(`/shows/${s.id}`);
      urls.add(`/shows/${s.id}/letras`);
    }
    for (const r of snap.rehearsals) {
      urls.add(`/ensaios/${r.id}`);
      urls.add(`/ensaios/${r.id}/letras`);
    }
  }
  await warm([...urls]);
  return { urls: urls.size };
}
