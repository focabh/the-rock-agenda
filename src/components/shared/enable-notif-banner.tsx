"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";

/** Aviso no topo do Painel pra quem AINDA não ativou notificações. Some sozinho
 *  quando a pessoa ativa (verifica a inscrição de push no aparelho). */
export function EnableNotifBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("notif-banner-dismiss") === "1") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    let alive = true;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (alive && !sub) setShow(true); // sem inscrição → mostra o aviso
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <Bell className="size-5 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Ative as notificações</p>
        <p className="text-xs text-muted-foreground">
          Receba avisos de show, ensaio e confirmação de presença no celular — mesmo com o app fechado.
        </p>
      </div>
      <Link
        href="/conta"
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Ativar
      </Link>
      <button
        onClick={() => {
          sessionStorage.setItem("notif-banner-dismiss", "1");
          setShow(false);
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        title="Agora não"
        aria-label="Dispensar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
