"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUp, Trash2 } from "lucide-react";
import { saveLogoAction, removeLogoAction } from "@/app/(app)/conta/actions";
import { ImageCropper } from "@/components/shared/image-cropper";
import { toast } from "sonner";

function readRaw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const DEFAULT_LOGO = "/the-rock-logo.png";

// Redimensiona a imagem para no máx. 256px e devolve um data URL pequeno.
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === "image/svg+xml") {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256;
        let { width, height } = img;
        if (width > max || height > max) {
          const scale = max / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function LogoUploader({ currentLogo }: { currentLogo: string }) {
  const [state, formAction, pending] = useActionState(saveLogoAction, null);
  const [, startTransition] = useTransition();
  const [preview, setPreview] = useState(currentLogo);
  const [dataUrl, setDataUrl] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) toast.success("Logo atualizada.");
    if (state?.error) toast.error(state.error);
  }, [state]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    // SVG não dá pra recortar no canvas — usa direto (vetorial, leve).
    if (file.type === "image/svg+xml") {
      try {
        const url = await resizeToDataUrl(file);
        setDataUrl(url);
        setPreview(url);
      } catch {
        toast.error("Não consegui ler a imagem.");
      }
      return;
    }
    try {
      setCropSrc(await readRaw(file)); // abre o enquadramento
    } catch {
      toast.error("Não consegui ler a imagem.");
    }
  }

  return (
    <Card>
      <CardContent className="py-6 space-y-4">
        <div>
          <h3 className="font-semibold">Logo do app</h3>
          <p className="text-sm text-muted-foreground">
            Aparece no menu e na tela de login. Quadrada fica melhor (PNG com
            fundo transparente é ideal).
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Logo" className="size-full object-contain" />
          </div>
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="logo" value={dataUrl} />
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50">
              <ImageUp className="size-4" />
              Escolher imagem
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button type="submit" disabled={pending || !dataUrl}>
              {pending ? "Salvando..." : "Salvar logo"}
            </Button>
          </form>
        </div>

        {currentLogo !== DEFAULT_LOGO && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (!confirm("Voltar para a logo padrão?")) return;
              startTransition(async () => {
                await removeLogoAction();
                setPreview(DEFAULT_LOGO);
                setDataUrl("");
                toast.success("Logo padrão restaurada.");
              });
            }}
          >
            <Trash2 className="size-4" /> Voltar para a logo padrão
          </Button>
        )}

        <ImageCropper
          src={cropSrc}
          aspect={1}
          cover={false}
          outputSize={400}
          format="png"
          title="Enquadrar logo"
          onCancel={() => setCropSrc(null)}
          onConfirm={(url) => {
            setDataUrl(url);
            setPreview(url);
            setCropSrc(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
