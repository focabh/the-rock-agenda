"use client";

import { useEffect } from "react";

/** Registra o service worker (PWA + Web Push + offline) E mantém o app
 *  atualizado: quando sai uma versão nova, o SW novo assume e a página recarrega
 *  sozinha (uma vez) — acaba o problema de "app velho preso em cache". */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      // Só recarrega se já havia um SW controlando (ou seja, é uma ATUALIZAÇÃO,
      // não a primeira instalação) — evita reload desnecessário no 1º acesso.
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        // Procura atualização agora e a cada 30 min (app aberto por muito tempo).
        reg.update().catch(() => {});
        const iv = window.setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        return () => window.clearInterval(iv);
      } catch (err) {
        console.error("SW register failed:", err);
      }
    };

    let cleanupInterval: (() => void) | undefined;
    const onLoad = () => {
      register().then((c) => {
        cleanupInterval = c;
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      cleanupInterval?.();
    };
  }, []);

  return null;
}
