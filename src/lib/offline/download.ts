"use client";

import { useOffline } from "./store";
import type { Snapshot } from "./types";

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

/** Dispara o download de TUDO no Service Worker (que roda em segundo plano,
 *  sobrevive à navegação e ao fechamento, e é retomável — pula o que já está em
 *  cache). O progresso chega por mensagens do SW (tratadas no OfflineProvider).
 *  Retorna o total de URLs enfileiradas (0 se o SW ainda não controla a página). */
export async function startFullDownload(): Promise<{ urls: number }> {
  await useOffline.getState().refresh();
  const snap = useOffline.getState().snapshot;
  const urls = buildOfflineUrlList(snap);

  const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
  if (!sw || !sw.controller) return { urls: 0 };

  useOffline.getState().setDownload({ active: true, done: 0, total: urls.length, complete: false });
  sw.controller.postMessage({ type: "DOWNLOAD_ALL", urls });
  return { urls: urls.length };
}
