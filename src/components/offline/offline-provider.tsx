"use client";

import { useEffect } from "react";
import { useOffline } from "@/lib/offline/store";
import { ensureActionsRegistered } from "@/lib/offline/actions-registry";
import { syncQueue } from "@/lib/offline/sync";
import { startFullDownload, DL_PENDING_KEY, DL_VERSION_KEY } from "@/lib/offline/download";
import { kvGet, kvSet, kvDel } from "@/lib/offline/idb";
import { toast } from "sonner";

/** Camada offline (escopo autenticado). Registra as actions; hidrata o snapshot
 *  (leve); calcula se o "baixar tudo" já está completo/atualizado; sincroniza a
 *  fila de mutações ao reconectar.
 *
 *  NÃO baixa tudo sozinho — o download é SÓ quando o usuário pede (botão). A
 *  única exceção é RETOMAR um download que o usuário começou e foi interrompido
 *  (flag dlPending), pra honrar "continuar de onde parou ao reconectar". */
export function OfflineProvider() {
  const hydrate = useOffline((s) => s.hydrate);
  const refresh = useOffline((s) => s.refresh);
  const setOnline = useOffline((s) => s.setOnline);
  const setDownload = useOffline((s) => s.setDownload);

  useEffect(() => {
    ensureActionsRegistered();
    let cancelled = false;
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;

    // Recalcula o estado do botão (completo / tem atualização) comparando a
    // versão do conteúdo baixado com a do snapshot atual.
    const recomputeDownloadState = async () => {
      try {
        const ver = useOffline.getState().snapshot?.version;
        const doneVer = await kvGet<string>(DL_VERSION_KEY);
        setDownload({
          complete: !!ver && doneVer === ver,
          hasNew: doneVer != null && doneVer !== ver,
        });
      } catch {
        /* ignora */
      }
    };

    // Progresso/conclusão do download vindos do SW.
    const onSwMsg = (e: MessageEvent) => {
      const m = e.data || {};
      if (m.type === "DOWNLOAD_PROGRESS") {
        setDownload({ active: true, done: m.cached ?? m.done, total: m.total });
      } else if (m.type === "DOWNLOAD_DONE") {
        if (m.complete) {
          const ver = useOffline.getState().snapshot?.version;
          setDownload({ active: false, complete: true, hasNew: false, done: m.done, total: m.total });
          if (ver) kvSet(DL_VERSION_KEY, ver).catch(() => {});
          kvDel(DL_PENDING_KEY).catch(() => {});
        } else {
          // interrompido (offline) → mantém dlPending pra retomar ao reconectar
          setDownload({ active: false });
        }
      }
    };
    sw?.addEventListener("message", onSwMsg);

    const doSync = async () => {
      const r = await syncQueue();
      if (r.done > 0) toast.success(`${r.done} alteração(ões) offline sincronizada(s).`);
    };

    // Retoma SÓ se o usuário já tinha começado um download (não inicia do nada).
    const resumeIfPending = async () => {
      if (typeof navigator === "undefined" || !navigator.onLine) return;
      try {
        const pending = await kvGet<boolean>(DL_PENDING_KEY);
        if (pending && !useOffline.getState().download.complete && !cancelled) {
          await startFullDownload();
        }
      } catch {
        /* ignora */
      }
    };

    (async () => {
      await hydrate();
      if (cancelled) return;
      await refresh();
      await recomputeDownloadState();
      await doSync();
      await resumeIfPending();
    })();

    const onOnline = () => {
      setOnline(true);
      refresh().then(recomputeDownloadState);
      doSync();
      resumeIfPending();
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
      sw?.removeEventListener("message", onSwMsg);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrate, refresh, setOnline, setDownload]);

  return null;
}
