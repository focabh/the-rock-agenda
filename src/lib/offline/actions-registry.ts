"use client";

// Registra as server actions que podem ser executadas OFFLINE (enfileiradas e
// replicadas no reconectar). Importado pelo OfflineProvider como side-effect,
// então o registry já está pronto antes de qualquer interação.
//
// Só entram aqui mutações "set" idempotentes (a última vence) — seguras pra
// replay em ordem. Nada de criar/excluir setlist offline (exige ida ao servidor).
import { registerAction } from "./mutations";
import { setPresenceAction } from "@/app/(app)/shows/[id]/actions-presence";
import { setRehearsalPresenceAction } from "@/app/(app)/agenda/actions";
import {
  updateSetlistItemAction,
  reorderSetlistItemsAction,
} from "@/app/(app)/shows/[id]/actions-setlist";
import {
  updateEnsaioSetlistItemAction,
  reorderEnsaioSetlistItemsAction,
} from "@/app/(app)/ensaios/[id]/actions-setlist";
import { setSongDropAction } from "@/app/(app)/repertorio/actions";

export const KIND = {
  setShowPresence: "setShowPresence",
  setRehearsalPresence: "setRehearsalPresence",
  updateSetlistItem: "updateSetlistItem",
  reorderSetlistItems: "reorderSetlistItems",
  updateEnsaioSetlistItem: "updateEnsaioSetlistItem",
  reorderEnsaioSetlistItems: "reorderEnsaioSetlistItems",
  setSongDrop: "setSongDrop",
} as const;

let registered = false;
export function ensureActionsRegistered(): void {
  if (registered) return;
  registered = true;
  registerAction(KIND.setShowPresence, setPresenceAction);
  registerAction(KIND.setRehearsalPresence, setRehearsalPresenceAction);
  registerAction(KIND.updateSetlistItem, updateSetlistItemAction);
  registerAction(KIND.reorderSetlistItems, reorderSetlistItemsAction);
  registerAction(KIND.updateEnsaioSetlistItem, updateEnsaioSetlistItemAction);
  registerAction(KIND.reorderEnsaioSetlistItems, reorderEnsaioSetlistItemsAction);
  registerAction(KIND.setSongDrop, setSongDropAction);
}
