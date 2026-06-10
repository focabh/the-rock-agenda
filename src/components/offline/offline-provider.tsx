"use client";

import { useEffect } from "react";
import { useOffline } from "@/lib/offline/store";
import { ensureActionsRegistered } from "@/lib/offline/actions-registry";
import { syncQueue } from "@/lib/offline/sync";
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
  }, [hydrate, refresh, setOnline]);

  return null;
}
