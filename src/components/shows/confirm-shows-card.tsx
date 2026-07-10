"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Check, X, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { updateShowStatusAction } from "@/app/(app)/shows/actions";
import { marcarShowRecebidoAction } from "@/app/(app)/shows/[id]/actions-payment";

export type ConfirmShow = {
  id: string;
  casaNome: string;
  dataLabel: string;
  cacheLabel: string | null;
};

/**
 * Shows passados ainda não resolvidos: confirma em poucos toques se aconteceu
 * (→ concluído) ou não (→ cancelado), e o cachê (pago/pendente). Some da lista
 * assim que resolvido.
 */
export function ConfirmShowsCard({ shows: initial }: { shows: ConfirmShow[] }) {
  const [shows, setShows] = useState(initial);
  // shows em que já marquei "realizado" e falta responder o cachê.
  const [awaitCache, setAwaitCache] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  if (shows.length === 0) return null;

  function remove(id: string) {
    setShows((xs) => xs.filter((s) => s.id !== id));
    setAwaitCache((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }

  function realizado(id: string) {
    setAwaitCache((s) => new Set(s).add(id)); // mostra o passo do cachê
    start(async () => {
      await updateShowStatusAction(id, "concluido").catch(() => {});
    });
  }

  function naoRolou(id: string) {
    remove(id);
    start(async () => {
      await updateShowStatusAction(id, "cancelado").catch(() => {});
    });
    toast("Marcado como cancelado.");
  }

  function cache(id: string, pago: boolean) {
    remove(id);
    if (pago) {
      start(async () => {
        await marcarShowRecebidoAction(id, null).catch(() => {});
      });
      toast.success("Show confirmado e cachê marcado como recebido. ✅");
    } else {
      toast.success("Show confirmado. Cachê fica como pendente (em Cachês).");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-amber-300">
        <CalendarCheck className="size-4" /> Confirmar shows ({shows.length})
      </h2>
      <Card className="divide-y divide-border p-0">
        {shows.map((s) => {
          const step2 = awaitCache.has(s.id);
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.casaNome}</p>
                <p className="text-xs text-muted-foreground">
                  {s.dataLabel}
                  {s.cacheLabel ? ` · ${s.cacheLabel}` : ""}
                </p>
              </div>

              {!step2 ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => realizado(s.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className="size-4" /> Realizado
                  </button>
                  <button
                    onClick={() => naoRolou(s.id)}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground"
                  >
                    <X className="size-4" /> Não rolou
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Coins className="size-3.5" /> Cachê:
                  </span>
                  <button
                    onClick={() => cache(s.id, true)}
                    className="rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-600"
                  >
                    Pago
                  </button>
                  <button
                    onClick={() => cache(s.id, false)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground"
                  >
                    Pendente
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </section>
  );
}
