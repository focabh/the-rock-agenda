"use client";

import { queuePut } from "./idb";
import { useOffline } from "./store";
import type { QueuedMutation } from "./types";

// Registry kind → server action. Preenchido por `actions-registry.ts` (módulo
// que importa as actions), evitando ciclos de import aqui. O replay (sync.ts)
// usa este mesmo registry pra reexecutar as mutações enfileiradas offline.
type ActionFn = (...args: never[]) => Promise<unknown>;
const registry: Record<string, ActionFn> = {};

export function registerAction(kind: string, fn: ActionFn): void {
  registry[kind] = fn;
}
export function getRegisteredAction(kind: string): ActionFn | undefined {
  return registry[kind];
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export type RunResult = { ok: boolean; queued: boolean; error?: string };

/** Executa a mutação:
 *  - ONLINE: chama a server action na hora. Se ela LANÇAR (erro de verdade),
 *    devolve o erro — NÃO enfileira (pra não envenenar a fila com erro que vai
 *    repetir pra sempre).
 *  - OFFLINE: enfileira no IndexedDB pra replay quando reconectar.
 *  O chamador faz a atualização otimista da UI por conta própria. */
export async function runOrQueue(
  kind: string,
  args: unknown[],
  opts?: { label?: string }
): Promise<RunResult> {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const fn = registry[kind];

  if (online) {
    if (!fn) return { ok: false, queued: false, error: `ação desconhecida: ${kind}` };
    try {
      await fn(...(args as never[]));
      return { ok: true, queued: false };
    } catch {
      return { ok: false, queued: false, error: "Não consegui salvar agora." };
    }
  }

  // Offline → enfileira
  try {
    const item: QueuedMutation = {
      id: newId(),
      kind,
      args,
      createdAt: Date.now(),
      label: opts?.label,
    };
    await queuePut(item);
    await useOffline.getState().refreshPending();
    return { ok: true, queued: true };
  } catch {
    return { ok: false, queued: false, error: "Não consegui salvar offline." };
  }
}
