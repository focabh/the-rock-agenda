"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { setBrandAction } from "@/app/(app)/conta/actions";

export function BrandSettings({
  initialName,
  initialBg,
  initialGrupo,
}: {
  initialName: string;
  initialBg: string;
  initialGrupo: string;
}) {
  const [name, setName] = useState(initialName);
  const [bg, setBg] = useState(initialBg);
  const [grupo, setGrupo] = useState(initialGrupo);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div>
          <p className="text-sm font-medium">Identidade do login</p>
          <p className="text-xs text-muted-foreground">
            Aparecem na tela de acesso. Sem imagem de fundo, usamos um fundo
            escuro neutro.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bandName">Nome da banda</Label>
          <Input
            id="bandName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: The Rock"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="backgroundUrl">URL da imagem de fundo (opcional)</Label>
          <Input
            id="backgroundUrl"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            placeholder="https://…/foto-da-banda.jpg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsappGrupo">Link do grupo da banda no WhatsApp</Label>
          <Input
            id="whatsappGrupo"
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            placeholder="https://chat.whatsapp.com/…"
          />
          <p className="text-xs text-muted-foreground">
            No WhatsApp: grupo → Convidar via link → Copiar. Cole aqui uma vez. Os
            avisos abrem o grupo já (você cola a mensagem e envia).
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setBrandAction(name, bg, grupo);
                if (r.ok) toast.success("Salvo.");
                else toast.error("Não foi possível salvar.");
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
