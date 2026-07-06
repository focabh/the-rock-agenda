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
  initialGrupo,
  initialGrupoMusicos,
  initialTomPadrao = "",
}: {
  initialName: string;
  initialGrupo: string;
  initialGrupoMusicos: string;
  initialTomPadrao?: string;
}) {
  const [name, setName] = useState(initialName);
  const [grupo, setGrupo] = useState(initialGrupo);
  const [grupoMusicos, setGrupoMusicos] = useState(initialGrupoMusicos);
  const [tomPadrao, setTomPadrao] = useState(initialTomPadrao);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div>
          <p className="text-sm font-medium">Identidade da banda</p>
          <p className="text-xs text-muted-foreground">
            Nome da banda e grupo do WhatsApp. As imagens de fundo têm seus
            próprios cards abaixo.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bandName">Nome da banda</Label>
          <Input id="bandName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: The Rock" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsappGrupo">Grupo da banda — shows e avisos gerais</Label>
          <Input id="whatsappGrupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="https://chat.whatsapp.com/…" />
          <p className="text-xs text-muted-foreground">
            Grupo com a manager. Recebe avisos de show, agenda e recebimento.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsappGrupoMusicos">Grupo dos músicos — ensaio e repertório (opcional)</Label>
          <Input id="whatsappGrupoMusicos" value={grupoMusicos} onChange={(e) => setGrupoMusicos(e.target.value)} placeholder="https://chat.whatsapp.com/…" />
          <p className="text-xs text-muted-foreground">
            Se preenchido, os lembretes de ensaio/repertório vão pra este grupo
            (sem a manager). Vazio → tudo cai no grupo da banda.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tomPadrao">Tom padrão da banda (transposição)</Label>
          <Input
            id="tomPadrao"
            type="number"
            inputMode="numeric"
            step={1}
            min={-12}
            max={12}
            value={tomPadrao}
            onChange={(e) => setTomPadrao(e.target.value)}
            placeholder="Ex.: -1 (vazio = sem padrão)"
            className="w-40"
          />
          <p className="text-xs text-muted-foreground">
            Como a banda costuma tocar (ex.: −1). No teleprompter, o tom de cada
            música é colorido pela distância deste padrão: igual = âmbar, mais
            dropado = laranja/vermelho, original (0) = cinza.
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setBrandAction(name, grupo, grupoMusicos, tomPadrao);
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
