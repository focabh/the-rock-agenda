"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ImageCropper } from "@/components/shared/image-cropper";
import { setBackgroundAction, removeBackgroundAction } from "@/app/(app)/conta/actions";

function readRaw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Uploader reutilizável de imagem de fundo (login OU app). Upload, trocar e excluir. */
export function BackgroundCard({
  kind,
  initial,
  titulo,
  hint,
}: {
  kind: "login" | "app";
  initial: string | null;
  titulo: string;
  hint: string;
}) {
  const [bg, setBg] = useState<string | null>(initial);
  const [pending, start] = useTransition();
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function salvar(url: string) {
    start(async () => {
      const r = await setBackgroundAction(kind, url);
      if (r.ok) {
        setBg(url);
        toast.success("Fundo atualizado.");
      } else {
        toast.error(r.error ?? "Não foi possível salvar.");
      }
    });
  }
  function onRemove() {
    start(async () => {
      await removeBackgroundAction(kind);
      setBg(null);
      toast.success("Fundo removido.");
    });
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <div>
          <p className="text-sm font-medium">{titulo}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {bg ? (
          <div className="w-full max-w-xs overflow-hidden rounded-md ring-1 ring-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bg} alt="" className="h-28 w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-28 w-full max-w-xs items-center justify-center rounded-md text-muted-foreground ring-1 ring-dashed ring-border">
            <ImageIcon className="size-6" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {bg ? "Trocar imagem" : "Enviar imagem"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.currentTarget.value = "";
                if (f) setCropSrc(await readRaw(f));
              }}
            />
          </label>
          {bg && (
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={pending} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" /> Excluir
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">Formatos: JPG, PNG ou WebP. Aparece corretamente no celular e no desktop.</p>

        <ImageCropper
          src={cropSrc}
          aspect={9 / 16}
          outputSize={810}
          format="jpeg"
          quality={0.82}
          title="Enquadrar fundo"
          onCancel={() => setCropSrc(null)}
          onConfirm={(url) => {
            setCropSrc(null);
            salvar(url);
          }}
        />
      </CardContent>
    </Card>
  );
}
