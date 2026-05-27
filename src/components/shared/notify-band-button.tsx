"use client";

import { useTransition } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notifyBandAction } from "@/app/(app)/notify-actions";

export function NotifyBandButton({
  title,
  body,
  url,
  tag,
  label = "Notificar banda",
  variant = "outline",
}: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  label?: string;
  variant?: "outline" | "default" | "ghost";
}) {
  const [pending, startTransition] = useTransition();

  function go() {
    if (!confirm("Enviar uma notificação push para toda a banda?")) return;
    startTransition(async () => {
      const r = await notifyBandAction({ title, body, url, tag });
      if (r?.error) {
        toast.error(r.error);
      } else if ((r?.sent ?? 0) === 0) {
        toast.info("Ninguém ativou notificações ainda.");
      } else {
        toast.success(`Notificação enviada para ${r.sent} dispositivo(s).`);
      }
    });
  }

  return (
    <Button variant={variant} size="sm" onClick={go} disabled={pending}>
      <BellRing className="size-4" />
      {pending ? "Enviando..." : label}
    </Button>
  );
}
