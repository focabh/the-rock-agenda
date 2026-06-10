"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOffline } from "@/lib/offline/store";
import { ensureActionsRegistered } from "@/lib/offline/actions-registry";
import { syncQueue } from "@/lib/offline/sync";
import { downloadAllForOffline } from "@/lib/offline/download";
import { toast } from "sonner";

/** Monta a camada offline (escopo autenticado):
 *  - registra as server actions que podem ser replicadas;
 *  - no 1º render carrega o snapshot do IndexedDB (instantâneo, offline) e, se
 *    online, busca o fresco;
 *  - ao reconectar (ou voltar o foco estando online) sincroniza a fila de
 *    mutações feitas offline e avisa quantas subiram. */
export function OfflineProvider() {
  const hydrate = useOffline((s) => s.hydrate);
  const refresh = useOffline((s) => s.refresh);
  const setOnline = useOffline((s) => s.setOnline);
  const router = useRouter();

  useEffect(() => {
    ensureActionsRegistered();

    let cancelled = false;
    (async () => {
      await hydrate();
      if (cancelled) return;
      await refresh();
      // se sobrou fila de um uso offline anterior e já estamos online, sobe agora
      const r = await syncQueue();
      if (!cancelled && r.done > 0) {
        toast.success(`${r.done} alteração(ões) offline sincronizada(s).`);
      }
      // Pré-baixa as telas de palco 1x por sessão (online, em segundo plano), pra
      // ficarem disponíveis offline sem o usuário abrir cada uma antes.
      try {
        if (
          !cancelled &&
          typeof navigator !== "undefined" &&
          navigator.onLine &&
          "serviceWorker" in navigator &&
          !sessionStorage.getItem("rock-warmed")
        ) {
          await navigator.serviceWorker.ready;
          sessionStorage.setItem("rock-warmed", "1");
          downloadAllForOffline((href) => router.prefetch(href)).catch(() => {});
        }
      } catch {
        /* best-effort */
      }
    })();

    const doSync = async () => {
      const r = await syncQueue();
      if (r.done > 0) toast.success(`${r.done} alteração(ões) offline sincronizada(s).`);
    };
    const onOnline = () => {
      setOnline(true);
      refresh();
      doSync();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) doSync();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrate, refresh, setOnline, router]);

  return null;
}
