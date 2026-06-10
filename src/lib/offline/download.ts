"use client";

import { useOffline } from "./store";
import type { Snapshot } from "./types";

/** Manda o SW pré-cachear uma lista de URLs (handler WARM_CACHE do sw.js). */
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
    setTimeout(() => {
      sw.removeEventListener("message", onMsg);
      resolve();
    }, 120000);
  });
}

/** Telas fixas (sem parâmetro) que a banda usa. */
const STATIC_ROUTES = [
  "/",
  "/repertorio",
  "/agenda",
  "/shows",
  "/ensaios",
  "/modo-show",
  "/financeiro",
  "/gastos",
  "/pagamentos",
  "/banda",
  "/casas",
  "/casas/funil",
  "/casas/descobrir",
  "/checklists",
  "/equipamentos",
  "/divulgacao",
  "/contratantes",
  "/posicoes",
  "/estatisticas",
  "/rider",
  "/ferramentas",
  "/sobre",
  "/conta",
  "/guia",
  "/guia/musico",
  "/guia/admin",
  "/shows/cartaz",
  "/api/offline/snapshot",
];

/** Monta a lista COMPLETA de URLs a baixar a partir do snapshot (todas as
 *  telas + cada música/show/ensaio/casa/membro). */
export function buildOfflineUrlList(snap: Snapshot | null): string[] {
  const urls = new Set<string>(STATIC_ROUTES);
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
    for (const v of snap.venues) urls.add(`/casas/${v.id}`);
    for (const m of snap.members) urls.add(`/banda/${m.id}`);
  }
  return [...urls];
}

/** Baixa TUDO pra offline: snapshot fresco + pré-cache de TODAS as telas
 *  (estáticas + cada música/show/ensaio/casa/membro). Processa em LOTES
 *  pequenos e sequenciais pra não sobrecarregar o navegador/servidor (baixar
 *  100+ páginas SSR de uma vez trava). Se receber `prefetch` (router.prefetch),
 *  também aquece o RSC/JS de cada rota — navegação offline funciona, não só o
 *  carregamento direto. `onProgress` reporta o avanço pra UI. */
export async function downloadAllForOffline(
  prefetch?: (href: string) => void,
  onProgress?: (done: number, total: number) => void
): Promise<{ urls: number }> {
  await useOffline.getState().refresh();
  const snap = useOffline.getState().snapshot;
  const urls = buildOfflineUrlList(snap);

  const BATCH = 5;
  for (let i = 0; i < urls.length; i += BATCH) {
    const group = urls.slice(i, i + BATCH);
    // aquece RSC/JS das rotas navegáveis do lote (ignora as de API)
    if (prefetch) {
      for (const u of group) {
        if (!u.startsWith("/api/")) {
          try {
            prefetch(u);
          } catch {
            /* best-effort */
          }
        }
      }
    }
    // cacheia os documentos do lote (e espera terminar antes do próximo)
    await warm(group);
    onProgress?.(Math.min(i + BATCH, urls.length), urls.length);
  }
  return { urls: urls.length };
}
