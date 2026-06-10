import { create } from "zustand";
import { kvGet, kvSet, queueCount } from "./idb";
import type { Snapshot } from "./types";

const SNAP_KEY = "snapshot";

type SyncStatus = "idle" | "syncing" | "error";

type OfflineStore = {
  /** Snapshot de palco atual (de IndexedDB ou da rede). */
  snapshot: Snapshot | null;
  /** Conexão segundo o browser. */
  online: boolean;
  /** Estado da sincronização do snapshot. */
  status: SyncStatus;
  /** version (epoch ms) do snapshot carregado. */
  lastSyncedAt: number | null;
  /** Quantas mutações offline aguardam replay. */
  pendingCount: number;
  /** Progresso/estado do "Baixar tudo pra offline".
   *  complete = tudo baixado pra versão atual do conteúdo.
   *  hasNew = já baixou antes, mas o conteúdo mudou (há atualização). */
  download: { active: boolean; done: number; total: number; complete: boolean; hasNew: boolean };
  setDownload: (d: Partial<OfflineStore["download"]>) => void;

  /** Carrega o snapshot persistido do IndexedDB (rápido, funciona offline). */
  hydrate: () => Promise<void>;
  /** Busca o snapshot fresco da rede e persiste (no-op se offline). */
  refresh: () => Promise<void>;
  /** Reconta a fila de mutações pendentes. */
  refreshPending: () => Promise<void>;
  setOnline: (b: boolean) => void;
};

export const useOffline = create<OfflineStore>((set, get) => ({
  snapshot: null,
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  status: "idle",
  lastSyncedAt: null,
  pendingCount: 0,
  download: { active: false, done: 0, total: 0, complete: false, hasNew: false },
  setDownload: (d) => set((s) => ({ download: { ...s.download, ...d } })),

  hydrate: async () => {
    try {
      const snap = await kvGet<Snapshot>(SNAP_KEY);
      if (snap) set({ snapshot: snap });
    } catch {
      /* IndexedDB indisponível — segue sem cache local */
    }
    await get().refreshPending();
  },

  refresh: async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    set({ status: "syncing" });
    try {
      const res = await fetch("/api/offline/snapshot", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("snapshot " + res.status);
      const snap = (await res.json()) as Snapshot;
      try {
        await kvSet(SNAP_KEY, snap);
      } catch {
        /* sem persistência — mantém em memória ao menos */
      }
      set({
        snapshot: snap,
        status: "idle",
        lastSyncedAt: Date.now(),
      });
    } catch {
      set({ status: "error" });
    }
  },

  refreshPending: async () => {
    try {
      set({ pendingCount: await queueCount() });
    } catch {
      /* ignora */
    }
  },

  setOnline: (b) => set({ online: b }),
}));
