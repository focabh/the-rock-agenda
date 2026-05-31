"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { fileToDownscaledDataUrl } from "@/lib/image-resize";
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
          <Label>Foto de fundo do login (opcional)</Label>
          {bg ? (
            <div className="relative w-40 overflow-hidden rounded-md ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg} alt="" className="h-24 w-full object-cover" />
              <button
                type="button"
                onClick={() => setBg("")}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                title="Remover"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
              <Upload className="size-4" /> Enviar foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setBg(await fileToDownscaledDataUrl(f, 1600, 0.8));
                }}
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Uma foto só, usada atrás do formulário de login. Sem foto, fundo
            escuro neutro.
          </p>
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
