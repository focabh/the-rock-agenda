"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { ImageCropper } from "@/components/shared/image-cropper";
import { toast } from "sonner";

function readRaw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Upload de foto do músico, integrado a um <form>.
 * Coloca os valores em inputs hidden ("avatar" e "removerAvatar") pra o
 * action server-side decidir manter, trocar ou apagar.
 */
export function AvatarUploader({
  initialAvatar,
  member,
  size = 80,
}: {
  initialAvatar: string | null;
  member: { id: string; nome: string; funcao: string; isManager?: boolean };
  size?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialAvatar);
  const [removed, setRemoved] = useState(false);
  const [data, setData] = useState<string>(""); // o que vai no form se trocou
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setCropSrc(await readRaw(file)); // abre o enquadramento
    } catch {
      toast.error("Não consegui ler a imagem.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = ""; // permite repicar o mesmo arquivo
    }
  }

  function remove() {
    setPreview(null);
    setData("");
    setRemoved(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Avatar pra preview: passa o data URL atual se existir; senão usa fallback.
  const previewMember = { ...member, avatar: preview ?? null };

  return (
    <div className="flex items-center gap-4">
      <MemberAvatar member={previewMember} size={size} />
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Camera className="size-4" />
            {busy ? "Processando..." : preview ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Sem foto, mostramos um ícone do instrumento.
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      <input type="hidden" name="avatar" value={data} />
      <input type="hidden" name="removerAvatar" value={removed ? "1" : ""} />

      <ImageCropper
        src={cropSrc}
        round
        aspect={1}
        outputSize={512}
        format="jpeg"
        title="Enquadrar foto"
        onCancel={() => setCropSrc(null)}
        onConfirm={(url) => {
          setPreview(url);
          setData(url);
          setRemoved(false);
          setCropSrc(null);
        }}
      />
    </div>
  );
}
