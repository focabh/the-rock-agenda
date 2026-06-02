"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { notificarAtualizacaoAction } from "@/app/(app)/conta/actions";

/** Força o app a pegar a versão mais nova: limpa caches, atualiza o service
 *  worker e recarrega. Útil se algo ficou "preso" numa versão antiga.
 *  Superusuário também pode avisar todos os dispositivos sobre atualização. */
export function UpdateAppButton({ canBroadcast = false }: { canBroadcast?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [avisando, startAviso] = useTransition();

  function avisarTodos() {
    startAviso(async () => {
      const r = await notificarAtualizacaoAction();
      if (r.ok) toast.success(`Aviso enviado a ${r.enviados} dispositivo(s).`);
      else toast.error("Não foi possível avisar.");
    });
  }

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
        <div className="flex flex-wrap gap-2">
          {canBroadcast && (
            <Button onClick={avisarTodos} disabled={avisando} variant="outline" title="Notifica todos os dispositivos que saiu uma atualização">
              <Megaphone className="size-4" />
              {avisando ? "Avisando…" : "Avisar todos"}
            </Button>
          )}
          <Button onClick={atualizar} disabled={busy} variant="outline">
            <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
            {busy ? "Atualizando…" : "Atualizar / Reiniciar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
