"use client";

import { useEffect } from "react";
import { useOffline } from "@/lib/offline/store";
import { ensureActionsRegistered } from "@/lib/offline/actions-registry";
import { syncQueue } from "@/lib/offline/sync";
import { startFullDownload } from "@/lib/offline/download";
import { kvGet, kvSet } from "@/lib/offline/idb";
import { toast } from "sonner";

const DL_DONE_KEY = "dlComplete";

/** Camada offline (escopo autenticado). Registra as actions; hidrata o snapshot;
 *  ouve o progresso do download (que roda no Service Worker, sobrevive à
 *  navegação e é retomável); auto-inicia/retoma o "baixar tudo" enquanto não
 *  estiver completo; e sincroniza a fila de mutações ao reconectar. */
export function OfflineProvider() {
  const hydrate = useOffline((s) => s.hydrate);
  const refresh = useOffline((s) => s.refresh);
  const setOnline = useOffline((s) => s.setOnline);
  const setDownload = useOffline((s) => s.setDownload);

  useEffect(() => {
    ensureActionsRegistered();
    let cancelled = false;
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;

    // progresso do download vindo do SW
    const onSwMsg = (e: MessageEvent) => {
      const m = e.data || {};
      if (m.type === "DOWNLOAD_PROGRESS") {
        setDownload({ active: true, done: m.cached ?? m.done, total: m.total });
      } else if (m.type === "DOWNLOAD_DONE") {
        setDownload({ active: false, done: m.done, total: m.total, complete: !!m.complete });
        if (m.complete) kvSet(DL_DONE_KEY, true).catch(() => {});
      }
    };
    sw?.addEventListener("message", onSwMsg);

    // inicia/retoma o download de tudo (SW pula o que já está em cache)
    const maybeDownload = async () => {
      if (typeof navigator === "undefined" || !navigator.onLine) return;
      if (!("serviceWorker" in navigator)) return;
      try {
        await navigator.serviceWorker.ready;
        const done = await kvGet<boolean>(DL_DONE_KEY);
        if (!done && !cancelled) await startFullDownload();
      } catch {
        /* best-effort */
      }
    };

    const doSync = async () => {
      const r = await syncQueue();
      if (r.done > 0) toast.success(`${r.done} alteração(ões) offline sincronizada(s).`);
    };

    (async () => {
      await hydrate();
      if (cancelled) return;
      await refresh();
      await doSync();
      maybeDownload();
    })();

    const onOnline = () => {
      setOnline(true);
      refresh();
      doSync();
      maybeDownload(); // retoma o download de onde parou
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        doSync();
        maybeDownload();
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      sw?.removeEventListener("message", onSwMsg);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrate, refresh, setOnline, setDownload]);

  return null;
}
