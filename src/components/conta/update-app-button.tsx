"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Força o app a pegar a versão mais nova: limpa caches, atualiza o service
 *  worker e recarrega. Útil se algo ficou "preso" numa versão antiga. */
export function UpdateAppButton() {
  const [busy, setBusy] = useState(false);

  async function atualizar() {
    setBusy(true);
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* segue pro reload de qualquer forma */
    }
    // Recarrega buscando tudo fresco.
    window.location.reload();
  }

  return (
    <Card>
      <CardContent className="py-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Atualizar o app</h3>
          <p className="text-sm text-muted-foreground">
            Pega a versão mais nova agora (limpa o cache e reinicia). Use se algo
            estiver estranho ou desatualizado.
          </p>
        </div>
        <Button onClick={atualizar} disabled={busy} variant="outline">
          <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
          {busy ? "Atualizando…" : "Atualizar / Reiniciar"}
        </Button>
      </CardContent>
    </Card>
  );
}
