"use client";

import { useOffline } from "./store";
import { kvSet } from "./idb";
import { syncAllLyricsAction } from "@/app/(app)/repertorio/actions";
import type { Snapshot } from "./types";

export const DL_PENDING_KEY = "dlPending";
export const DL_VERSION_KEY = "dlCompleteVersion";

/** Telas de PALCO (o que se usa no show). O resto (financeiro, casas, banda,
 *  etc.) NÃO é baixado de propósito — não precisa offline e deixa o download
 *  leve e rápido. */
const STAGE_ROUTES = [
  "/",
  "/repertorio",
  "/modo-show",
  "/shows",
  "/ensaios",
  "/api/offline/snapshot",
];

/** Monta a lista de URLs de PALCO a baixar: repertório (cada música), modo show,
 *  e cada show/ensaio + suas letras (teleprompter) + setlist pra imprimir. */
export function buildOfflineUrlList(snap: Snapshot | null): string[] {
  const urls = new Set<string>(STAGE_ROUTES);
  if (snap) {
    for (const s of snap.songs) urls.add(`/repertorio/${s.id}`);
    for (const sh of snap.shows) {
      urls.add(`/shows/${sh.id}`);
      urls.add(`/shows/${sh.id}/letras`);
      urls.add(`/shows/${sh.id}/imprimir-setlist`);
    }
    for (const r of snap.rehearsals) {
      urls.add(`/ensaios/${r.id}`);
      urls.add(`/ensaios/${r.id}/letras`);
      urls.add(`/ensaios/${r.id}/imprimir-setlist`);
    }
  }
  return [...urls];
}

/** Dispara o download de TUDO no Service Worker (que roda em segundo plano,
 *  sobrevive à navegação e ao fechamento, e é retomável — pula o que já está em
 *  cache). O progresso chega por mensagens do SW (tratadas no OfflineProvider).
 *  Retorna o total de URLs enfileiradas (0 se o SW ainda não controla a página). */
export async function startFullDownload(
  opts: { force?: boolean } = {}
): Promise<{ urls: number }> {
  // estado "preparando" enquanto busca as letras que faltam
  useOffline.getState().setDownload({ active: true, done: 0, total: 0, complete: false, hasNew: false });

  // 1) GARANTE as letras (e letras sincronizadas do teleprompter) no banco —
  //    elas são cacheadas só na 1ª abertura, então sem isso o snapshot offline
  //    viria sem letra. Qualquer músico logado pode disparar (requireCurrentUser).
  try {
    await syncAllLyricsAction();
  } catch {
    /* sem permissão/erro de rede → segue com as letras que já existem */
  }

  // 2) snapshot fresco (agora com as letras) + lista de URLs de palco
  await useOffline.getState().refresh();
  const snap = useOffline.getState().snapshot;
  const urls = buildOfflineUrlList(snap);

  const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
  if (!sw || !sw.controller) {
    useOffline.getState().setDownload({ active: false });
    return { urls: 0 };
  }

  // marca que um download foi INTENCIONADO (pra retomar se cair a conexão)
  try {
    await kvSet(DL_PENDING_KEY, true);
  } catch {
    /* ignora */
  }
  useOffline.getState().setDownload({ active: true, done: 0, total: urls.length, complete: false, hasNew: false });
  // force=true (Atualizar): re-baixa as páginas que mudaram. force=false
  // (1ª vez/retomar): pula o que já está em cache.
  sw.controller.postMessage({ type: "DOWNLOAD_ALL", urls, force: !!opts.force });
  return { urls: urls.length };
}
