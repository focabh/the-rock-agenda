"use client";

import { useEffect, useState } from "react";
import { Download, Check, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Pré-baixa esta página (e URLs extras) pro cache do service worker, pra usar
 *  offline no show. Pede ao SW via postMessage. */
export function OfflineDownloadButton({ extraUrls = [] }: { extraUrls?: string[] }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "WARM_CACHE_DONE") {
        setState("done");
        toast.success("Show salvo pra usar offline. Pode tocar tranquilo. 🤘");
      }
    }
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);

  async function baixar() {
    if (!("serviceWorker" in navigator)) {
      toast.error("Seu navegador não suporta offline.");
      return;
    }
    setState("saving");
    const reg = await navigator.serviceWorker.ready;
    const urls = [window.location.href, ...extraUrls];
    reg.active?.postMessage({ type: "WARM_CACHE", urls });
    // Fallback: se o SW não responder em 8s, considera feito assim mesmo.
    setTimeout(() => setState((s) => (s === "saving" ? "done" : s)), 8000);
  }

  return (
    <Button
      variant={state === "done" ? "outline" : "default"}
      size="sm"
      onClick={baixar}
      disabled={state === "saving"}
      title={online ? "Salvar este show pra acessar sem internet" : "Você está offline"}
    >
      {state === "saving" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "done" ? (
        <Check className="size-4" />
      ) : online ? (
        <Download className="size-4" />
      ) : (
        <WifiOff className="size-4" />
      )}
      {state === "saving" ? "Salvando…" : state === "done" ? "Salvo offline" : "Baixar pra offline"}
    </Button>
  );
}
