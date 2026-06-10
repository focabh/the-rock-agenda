"use client";

import { useState } from "react";
import { CloudOff, RefreshCw, Download, Check } from "lucide-react";
import { useOffline } from "@/lib/offline/store";
import { downloadAllForOffline } from "@/lib/offline/download";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Pílula de status: só aparece quando há algo a comunicar (offline, pendências
 *  ou sincronizando). Online e tudo sincronizado → não polui a UI. */
export function OfflineStatusPill({ className }: { className?: string }) {
  const online = useOffline((s) => s.online);
  const status = useOffline((s) => s.status);
  const pending = useOffline((s) => s.pendingCount);

  const syncing = status === "syncing" && online;
  if (online && pending === 0 && !syncing) return null;

  let label: string;
  let tone: string;
  let Icon = CloudOff;
  if (!online) {
    Icon = CloudOff;
    tone = "bg-amber-500/15 text-amber-300 ring-amber-500/30";
    label = pending > 0 ? `Offline · ${pending} pendente(s)` : "Offline";
  } else if (syncing) {
    Icon = RefreshCw;
    tone = "bg-primary/15 text-primary ring-primary/30";
    label = "Sincronizando…";
  } else {
    Icon = RefreshCw;
    tone = "bg-amber-500/15 text-amber-300 ring-amber-500/30";
    label = `${pending} pra sincronizar`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        tone,
        className
      )}
      title={
        online
          ? "Alterações feitas offline aguardando subir"
          : "Sem conexão — você pode continuar; tudo sincroniza ao voltar"
      }
    >
      <Icon className={cn("size-3.5", syncing && "animate-spin")} />
      {label}
    </span>
  );
}

/** Botão "Baixar tudo pra offline": pré-cacheia as telas de palco + snapshot. */
export function DownloadOfflineButton({ className }: { className?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const online = useOffline((s) => s.online);

  async function run() {
    if (state === "loading") return;
    if (!online) {
      toast.error("Conecte à internet pra baixar o conteúdo offline.");
      return;
    }
    setState("loading");
    try {
      const { urls } = await downloadAllForOffline();
      setState("done");
      toast.success(`Pronto pra offline (${urls} telas baixadas).`);
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
      toast.error("Não consegui baixar tudo agora.");
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === "loading"}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-inset ring-border transition-colors hover:bg-accent/50 disabled:opacity-60",
        className
      )}
      title="Baixa letras, setlists, shows e ensaios pra usar sem internet no palco"
    >
      {state === "loading" ? (
        <RefreshCw className="size-4 animate-spin" />
      ) : state === "done" ? (
        <Check className="size-4 text-emerald-400" />
      ) : (
        <Download className="size-4" />
      )}
      {state === "loading" ? "Baixando…" : state === "done" ? "Baixado!" : "Baixar tudo pra offline"}
    </button>
  );
}
