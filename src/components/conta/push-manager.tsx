"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  subscribePushAction,
  unsubscribePushAction,
  sendTestPushAction,
} from "@/app/(app)/conta/push-actions";

/** Garante que uma promessa não trava pra sempre (celular às vezes não resolve). */
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushManager() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [pending, startTransition] = useTransition();
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  function subscribe() {
    if (!vapid) {
      toast.error("Notificações ainda não configuradas no servidor.");
      return;
    }
    startTransition(async () => {
      try {
        const permission = await withTimeout(
          Notification.requestPermission(),
          60000,
          "permissão demorou demais"
        );
        if (permission !== "granted") {
          toast.error("Permissão de notificação negada.");
          return;
        }
        const reg = await withTimeout(navigator.serviceWorker.ready, 15000, "service worker não pronto");
        const sub = await withTimeout(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid),
          }),
          20000,
          "não consegui inscrever no push"
        );
        const json = JSON.parse(JSON.stringify(sub));
        const r = await withTimeout(
          subscribePushAction(json, window.navigator.userAgent),
          15000,
          "servidor demorou demais"
        );
        if (r?.error) {
          toast.error(r.error);
          return;
        }
        setSubscribed(true);
        toast.success("Notificações ativadas neste dispositivo. 🤘");
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? `Não consegui ativar: ${err.message}` : "Não consegui ativar as notificações.");
      }
    });
  }

  function unsubscribe() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await unsubscribePushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
        toast.success("Notificações desativadas neste dispositivo.");
      } catch {
        toast.error("Não consegui desativar.");
      }
    });
  }

  function test() {
    startTransition(async () => {
      const r = await sendTestPushAction();
      if (r?.error) toast.error(r.error);
      else toast.success("Notificação de teste enviada!");
    });
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
            <Bell className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">Notificações</h3>
            <p className="text-sm text-muted-foreground">
              Receba avisos de shows, ensaios e pedidos de confirmação direto no
              celular — mesmo com o app fechado.
            </p>
          </div>
        </div>

        {!supported ? (
          <p className="text-sm text-muted-foreground">
            Este navegador não suporta notificações.
            {isIOS &&
              " No iPhone, adicione o app à Tela de Início (instruções abaixo) e abra por lá."}
          </p>
        ) : isIOS && !isStandalone ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-2">
            <p className="font-medium">Para ativar no iPhone/iPad:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li className="flex items-center gap-1.5">
                Toque em <Share className="size-4 inline" /> Compartilhar no
                Safari
              </li>
              <li className="flex items-center gap-1.5">
                Escolha <Plus className="size-4 inline" /> &quot;Adicionar à Tela
                de Início&quot;
              </li>
              <li>Abra o app pelo ícone e volte aqui para ativar.</li>
            </ol>
          </div>
        ) : subscribed ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
              <BellRing className="size-4" />
              Ativadas neste dispositivo
            </span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={test} disabled={pending}>
              Enviar teste
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={unsubscribe}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
            >
              <BellOff className="size-4" />
              Desativar
            </Button>
          </div>
        ) : (
          <Button onClick={subscribe} disabled={pending}>
            <Bell className="size-4" />
            {pending ? "Ativando..." : "Ativar notificações"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
