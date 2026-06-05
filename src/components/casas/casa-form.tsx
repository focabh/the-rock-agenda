"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { AtSign, Upload, Loader2, X, Eraser, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { removeWhiteBackground } from "@/lib/remove-bg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { PhoneInput } from "@/components/shared/phone-input";
import { buscarLogoCasaAction } from "@/app/(app)/casas/actions";
import { ImageCropper } from "@/components/shared/image-cropper";

function readRawFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
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
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  // Guarda a logo de antes pra permitir "desfazer" o recorte do fundo.
  const [antesFundo, setAntesFundo] = useState<string | null>(null);

  async function tirarFundo() {
    if (!logo) return;
    setProcessando(true);
    try {
      const semFundo = await removeWhiteBackground(logo);
      setAntesFundo(logo);
      setLogo(semFundo);
      toast.success("Fundo branco removido. Confira o preview.");
    } catch {
      toast.error("Não consegui processar essa imagem.");
    } finally {
      setProcessando(false);
    }
  }

  function buscarNoGoogle() {
    const nome = (document.getElementById("nome") as HTMLInputElement | null)?.value ?? "";
    const cidade = (document.querySelector('input[name="cidade"]') as HTMLInputElement | null)?.value ?? "";
    if (!nome.trim()) {
      toast.error("Preencha o nome da casa primeiro.");
      return;
    }
    startBusca(async () => {
      const r = await buscarLogoCasaAction(nome, cidade);
      if (r.ok) {
        setLogo(r.dataUrl);
        setAntesFundo(null);
        toast.success("Imagem encontrada no Google!");
      } else {
        toast.error(r.erro);
      }
    });
  }

  async function onUpload(file: File) {
    setCropSrc(await readRawFile(file));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="logoUrl" value={logo ?? ""} />
      <ImageCropper
        src={cropSrc}
        aspect={1}
        cover={false}
        outputSize={400}
        format="png"
        title="Enquadrar logo da casa"
        onCancel={() => setCropSrc(null)}
        onConfirm={(url) => {
          setLogo(url);
          setAntesFundo(null);
          setCropSrc(null);
        }}
      />
      {logo ? (
        // Fundo xadrez pra enxergar a transparência depois de tirar o fundo.
        <div
          className="size-16 rounded-md ring-1 ring-border"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#9994 25%,transparent 25%),linear-gradient(-45deg,#9994 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#9994 75%),linear-gradient(-45deg,transparent 75%,#9994 75%)",
            backgroundSize: "10px 10px",
            backgroundPosition: "0 0,0 5px,5px -5px,-5px 0",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="logo da casa" className="size-16 object-contain" />
        </div>
      ) : (
        <div className="flex size-16 items-center justify-center rounded-md text-xs text-muted-foreground ring-1 ring-dashed ring-border">
          sem logo
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={buscarNoGoogle} disabled={busca}>
          {busca ? <Loader2 className="size-4 animate-spin" /> : <AtSign className="size-4" />}
          Buscar no Google
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-sm hover:bg-accent">
          <Upload className="size-4" /> Enviar imagem
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
        </label>
        {logo && !antesFundo && (
          <Button type="button" variant="outline" size="sm" onClick={tirarFundo} disabled={processando}>
            {processando ? <Loader2 className="size-4 animate-spin" /> : <Eraser className="size-4" />}
            Tirar fundo branco
          </Button>
        )}
        {antesFundo && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setLogo(antesFundo); setAntesFundo(null); }} className="text-muted-foreground">
            <Undo2 className="size-4" /> Desfazer fundo
          </Button>
        )}
        {logo && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setLogo(null); setAntesFundo(null); }} className="text-muted-foreground">
            <X className="size-4" /> Remover
          </Button>
        )}
      </div>
      <p className="w-full text-[11px] text-muted-foreground">
        “Buscar no Google” pega a foto da casa no Google (e o @ se estiver no perfil). O flyer do show usa essa imagem automaticamente. Pra uma logo exata, envie a imagem.{" "}
        <strong className="text-foreground">“Tirar fundo branco”</strong> deixa a logo transparente (ideal pra logos de fundo branco chapado, ex.: print do Instagram).
      </p>
    </div>
  );
}
