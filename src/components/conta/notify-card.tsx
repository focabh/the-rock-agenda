"use client";

import { useState, useTransition } from "react";
import { Send, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enviarNotificacaoAction } from "@/app/(app)/conta/actions";
import { toast } from "sonner";

/** Dispara uma notificação (recado livre) pros aparelhos da banda. */
export function NotifyCard() {
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [pending, start] = useTransition();

  function enviar() {
    if (!corpo.trim()) {
      toast.error("Escreva o recado.");
      return;
    }
    start(async () => {
      const r = await enviarNotificacaoAction(titulo, corpo);
      if (r.ok) {
        toast.success(
          r.enviados ? `Enviado a ${r.enviados} dispositivo(s).` : "Enviado — mas ninguém com notificação ativa ainda."
        );
        setTitulo("");
        setCorpo("");
      } else {
        toast.error(r.error ?? "Não foi possível enviar.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
            <Megaphone className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Enviar notificação à banda</h3>
            <p className="text-sm text-muted-foreground">
              Manda um recado direto pros celulares de quem ativou notificações.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ntitulo">Título (opcional)</Label>
          <Input
            id="ntitulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Ensaio confirmado"
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ncorpo">Recado *</Label>
          <Textarea
            id="ncorpo"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={3}
            placeholder="Ex.: Quinta 20h no estúdio. Confirmem presença!"
            maxLength={300}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={enviar} disabled={pending}>
            <Send className="size-4" />
            {pending ? "Enviando…" : "Disparar notificação"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
