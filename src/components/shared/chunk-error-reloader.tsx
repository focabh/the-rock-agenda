"use client";

import { useEffect } from "react";

const STALE_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|'?text\/html'? is not a valid JavaScript MIME type/i;

/**
 * Quando o navegador está rodando uma versão antiga do app (após um deploy),
 * clicar/navegar tenta carregar arquivos JS que não existem mais e dá erro.
 * Aqui detectamos esse tipo de erro e recarregamos a página UMA vez para pegar
 * a versão nova (o HTML é no-store, então o reload vem fresco).
 */
export function ChunkErrorReloader() {
  useEffect(() => {
    const KEY = "__stale_reload_at";

    function maybeReload(message?: string) {
      if (!message || !STALE_RE.test(message)) return;
      const last = Number(sessionStorage.getItem(KEY) || "0");
      if (Date.now() - last < 15000) return; // evita loop de reload
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    }

    function onError(e: ErrorEvent) {
      maybeReload(e?.message || (e?.error && e.error.message));
    }
    function onRejection(e: PromiseRejectionEvent) {
      const r = e?.reason;
      maybeReload(typeof r === "string" ? r : r?.message);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
