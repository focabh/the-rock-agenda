"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { AtSign, Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { PhoneInput } from "@/components/shared/phone-input";
import { fileToDownscaledDataUrl } from "@/lib/image-resize";
import { buscarLogoInstagramAction } from "@/app/(app)/casas/actions";
import type { ActionState } from "@/lib/form";
import type { Venue } from "@/db/schema";

type Props = {
  casa?: Venue;
  action: (
    prev: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  submitLabel?: string;
};

export function CasaForm({ casa, action, submitLabel = "Salvar" }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nome">Nome da casa *</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={casa?.nome ?? ""}
              required
              autoFocus
            />
            <FieldError state={state} name="nome" />
          </div>

          <div className="sm:col-span-2">
            <AddressAutocomplete
              defaultValue={casa?.endereco ?? ""}
              defaults={{
                cidade: casa?.cidade ?? "",
                bairro: casa?.bairro ?? "",
                estado: casa?.estado ?? "",
                lat: casa?.latitude?.toString() ?? "",
                lon: casa?.longitude?.toString() ?? "",
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contatoPrincipal">Contato</Label>
            <Input
              id="contatoPrincipal"
              name="contatoPrincipal"
              defaultValue={casa?.contatoPrincipal ?? ""}
              placeholder="Nome do responsável"
            />
            <FieldError state={state} name="contatoPrincipal" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone / WhatsApp</Label>
            <PhoneInput
              id="telefone"
              name="telefone"
              defaultValue={casa?.telefone ?? ""}
            />
            <FieldError state={state} name="telefone" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="instagram">Instagram (opcional)</Label>
            <Input
              id="instagram"
              name="instagram"
              defaultValue={casa?.instagram ?? ""}
              placeholder="@bardozé ou link do perfil"
            />
            <FieldError state={state} name="instagram" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Logo da casa (pro flyer)</Label>
            <LogoCasaField initial={casa?.logoUrl ?? null} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="whatsappGrupo">Grupo no WhatsApp (com a casa)</Label>
            <Input
              id="whatsappGrupo"
              name="whatsappGrupo"
              defaultValue={casa?.whatsappGrupo ?? ""}
              placeholder="https://chat.whatsapp.com/… (link de convite do grupo)"
            />
            <FieldError state={state} name="whatsappGrupo" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="infraestrutura">Infraestrutura técnica (da casa)</Label>
            <Textarea
              id="infraestrutura"
              name="infraestrutura"
              rows={2}
              defaultValue={casa?.infraestrutura ?? ""}
              placeholder="Ex.: PA próprio 2x15, mesa 16 canais, palco 4x3m, 2 tomadas 110V, sem retorno..."
            />
            <FieldError state={state} name="infraestrutura" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={3}
              defaultValue={casa?.observacoes ?? ""}
              placeholder="Particularidades da casa, melhores horários, dicas..."
            />
            <FieldError state={state} name="observacoes" />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2">
            {state?.error && !state.fieldErrors && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="ml-auto flex gap-2">
              <Button render={<Link href="/casas" />} variant="outline">
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LogoCasaField({ initial }: { initial: string | null }) {
  const [logo, setLogo] = useState<string | null>(initial);
  const [busca, startBusca] = useTransition();

  function buscarDoInstagram() {
    const ig = (document.getElementById("instagram") as HTMLInputElement | null)?.value ?? "";
    if (!ig.trim()) {
      toast.error("Preencha o @ do Instagram acima primeiro.");
      return;
    }
    startBusca(async () => {
      const r = await buscarLogoInstagramAction(ig);
      if (r.ok) {
        setLogo(r.dataUrl);
        toast.success("Logo do Instagram encontrada!");
      } else {
        toast.error(r.erro);
      }
    });
  }

  async function onUpload(file: File) {
    setLogo(await fileToDownscaledDataUrl(file, 512, 0.85));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="logoUrl" value={logo ?? ""} />
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="logo da casa" className="size-16 rounded-md object-contain ring-1 ring-border" />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-md text-xs text-muted-foreground ring-1 ring-dashed ring-border">
          sem logo
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={buscarDoInstagram} disabled={busca}>
          {busca ? <Loader2 className="size-4 animate-spin" /> : <AtSign className="size-4" />}
          Buscar do Instagram
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-sm hover:bg-accent">
          <Upload className="size-4" /> Enviar imagem
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
        {logo && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)} className="text-muted-foreground">
            <X className="size-4" /> Remover
          </Button>
        )}
      </div>
      <p className="w-full text-[11px] text-muted-foreground">
        Tenta puxar a foto de perfil do Instagram pelo @ (nem sempre o IG deixa). O flyer do show usa essa logo automaticamente.
      </p>
    </div>
  );
}
