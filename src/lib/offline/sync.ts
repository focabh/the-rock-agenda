"use client";

import { queueAll, queueDel } from "./idb";
import { getRegisteredAction } from "./mutations";
import { useOffline } from "./store";

let syncing = false;

export type SyncResult = { done: number; failed: number };

/** Replica a fila de mutações offline contra o servidor, em ordem de criação
 *  (last-write-wins natural: as actions são "set", então a última prevalece).
 *  Para na 1ª falha pra preservar a ordem (provável queda de rede de novo).
 *  Ao final, se sincronizou algo, baixa o snapshot fresco. */
export async function syncQueue(): Promise<SyncResult> {
  if (syncing) return { done: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { done: 0, failed: 0 };
  }
  syncing = true;
  let done = 0;
  let failed = 0;
  try {
    const items = (await queueAll()).sort((a, b) => a.createdAt - b.createdAt);
    for (const it of items) {
      const fn = getRegisteredAction(it.kind);
      if (!fn) {
        // kind desconhecido (ex.: versão antiga) → descarta pra não travar a fila
        await queueDel(it.id);
        continue;
      }
      try {
        await fn(...(it.args as never[]));
        await queueDel(it.id);
        done++;
      } catch {
        failed++;
        break;
      }
    }
  } finally {
    syncing = false;
    await useOffline.getState().refreshPending();
  }
  if (done > 0) await useOffline.getState().refresh();
  return { done, failed };
}
