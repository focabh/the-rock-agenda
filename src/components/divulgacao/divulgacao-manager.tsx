"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Video,
  Image as ImageIcon,
  FileText,
  Download,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Paperclip,
  Link2,
  Wrench,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/shared/field-error";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/upload-helpers";
import {
  createPromoAction,
  updatePromoAction,
  deletePromoAction,
} from "@/app/(app)/divulgacao/actions";
import { toast } from "sonner";

type Tipo = "video" | "foto" | "logo" | "presskit" | "rider";

export type PromoLite = {
  id: string;
  tipo: Tipo;
  titulo: string;
  url: string;
  descricao: string | null;
};

type TipoMeta = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  singleton: boolean;
  max: number;
  helper: string;
  // configuração do upload
  upload: false | { accept: string; maxMB: number };
};

const TIPO_META: Record<Tipo, TipoMeta> = {
  video: {
    label: "Vídeos",
    icon: Video,
    singleton: false,
    max: 50,
    helper: "Cole o link de YouTube, Vimeo, Instagram ou Google Drive.",
    upload: false,
  },
  foto: {
    label: "Fotos",
    icon: ImageIcon,
    singleton: false,
    max: 15,
    helper: "Até 15 fotos. JPEG, PNG ou WEBP, até ~2MB cada.",
    upload: { accept: "image/jpeg,image/png,image/webp", maxMB: 2 },
  },
  logo: {
    label: "Logo",
    icon: Download,
    singleton: false,
    max: 10,
    helper: "PNG/JPEG até ~2MB. Suba variações (colorida, preto-no-branco, etc).",
    upload: { accept: "image/jpeg,image/png,image/webp", maxMB: 2 },
  },
  presskit: {
    label: "Press kit",
    icon: FileText,
    singleton: true,
    max: 1,
    helper: "PDF público até ~5MB. Substituir troca o press kit atual.",
    upload: { accept: "application/pdf,image/jpeg,image/png", maxMB: 5 },
  },
  rider: {
    label: "Rider técnico",
    icon: Wrench,
    singleton: true,
    max: 1,
    helper: "Lista de equipamentos/exigências (PDF até ~5MB).",
    upload: { accept: "application/pdf,image/jpeg,image/png", maxMB: 5 },
  },
};

const TIPO_ORDER: Tipo[] = ["video", "foto", "logo", "presskit", "rider"];

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DivulgacaoManager({
  items,
  admin,
}: {
  items: PromoLite[];
  admin: boolean;
}) {
  const [editing, setEditing] = useState<PromoLite | null>(null);
  const [addingTipo, setAddingTipo] = useState<Tipo | null>(null);

  const byTipo: Record<Tipo, PromoLite[]> = {
    video: [],
    foto: [],
    logo: [],
    presskit: [],
    rider: [],
  };
  for (const i of items) byTipo[i.tipo].push(i);

  return (
    <div className="space-y-6">
      {TIPO_ORDER.map((tipo) => {
        const meta = TIPO_META[tipo];
        const list = byTipo[tipo];
        const Icon = meta.icon;
        const atLimit = list.length >= meta.max;
        const addLabel = meta.singleton && list.length > 0 ? "Substituir" : "Adicionar";
        const AddIcon = meta.singleton && list.length > 0 ? RefreshCw : Plus;

        return (
          <section key={tipo} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  {meta.label}{" "}
                  {list.length > 0 && (
                    <span className="text-sm text-muted-foreground font-normal">
                      ({list.length}
                      {!meta.singleton && `/${meta.max}`})
                    </span>
                  )}
                </h2>
                {admin && (
                  <p className="text-xs text-muted-foreground">{meta.helper}</p>
                )}
              </div>
              {admin && (!atLimit || meta.singleton) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingTipo(tipo)}
                >
                  <AddIcon className="size-4" /> {addLabel}
                </Button>
              )}
            </div>

            {list.length === 0 ? (
              <Card>
                <CardContent className="py-5">
                  <p className="text-sm text-muted-foreground">
                    Nada por aqui ainda.
                  </p>
                </CardContent>
              </Card>
            ) : tipo === "foto" ? (
              <FotoGrid items={list} admin={admin} onEdit={(i) => setEditing(i)} />
            ) : (
              <ItemList items={list} admin={admin} onEdit={(i) => setEditing(i)} />
            )}
          </section>
        );
      })}

      {items.length === 0 && admin && (
        <EmptyState
          icon={Plus}
          title="Comece adicionando seu primeiro material"
          description="Vídeos, fotos, logo, press kit e rider técnico ficam disponíveis pra toda a banda compartilhar."
        />
      )}

      {addingTipo && (
        <FormDialog
          tipoFixed={addingTipo}
          open={Boolean(addingTipo)}
          onOpenChange={(o) => !o && setAddingTipo(null)}
        />
      )}
      {editing && (
        <FormDialog
          item={editing}
          open={Boolean(editing)}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}

function ItemList({
  items,
  admin,
  onEdit,
}: {
  items: PromoLite[];
  admin: boolean;
  onEdit: (i: PromoLite) => void;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <a
                href={i.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-primary truncate inline-flex items-center gap-1.5"
              >
                {i.titulo}
                <ExternalLink className="size-3.5 opacity-60" />
              </a>
              {i.descricao && (
                <p className="text-xs text-muted-foreground truncate">
                  {i.descricao}
                </p>
              )}
            </div>
            {admin && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Editar"
                  onClick={() => onEdit(i)}
                >
                  <Pencil className="size-4" />
                </Button>
                <DeleteBtn id={i.id} />
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FotoGrid({
  items,
  admin,
  onEdit,
}: {
  items: PromoLite[];
  admin: boolean;
  onEdit: (i: PromoLite) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((i) => (
        <div
          key={i.id}
          className="relative group rounded-md overflow-hidden border border-border bg-card"
        >
          <a
            href={i.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-square bg-muted/30"
            title={i.titulo}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={i.url}
              alt={i.titulo}
              className="size-full object-cover"
            />
          </a>
          <div className="px-2 py-1.5 flex items-center gap-1">
            <p className="text-xs truncate flex-1" title={i.titulo}>
              {i.titulo}
            </p>
            {admin && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  className="p-1 text-muted-foreground hover:text-primary"
                  title="Editar"
                >
                  <Pencil className="size-3.5" />
                </button>
                <DeleteBtn id={i.id} compact />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DeleteBtn({ id, compact = false }: { id: string; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  if (compact) {
    return (
      <button
        type="button"
        title="Remover"
        disabled={pending}
        onClick={() => {
          if (!confirm("Remover este item?")) return;
          startTransition(async () => {
            await deletePromoAction(id);
            toast.success("Item removido.");
          });
        }}
        className="p-1 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      title="Remover"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remover este item?")) return;
        startTransition(async () => {
          await deletePromoAction(id);
          toast.success("Item removido.");
        });
      }}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function FormDialog({
  item,
  tipoFixed,
  open,
  onOpenChange,
}: {
  item?: PromoLite;
  tipoFixed?: Tipo;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const action = item
    ? updatePromoAction.bind(null, item.id)
    : createPromoAction;
  const [state, formAction, pending] = useActionState(action, null);

  const tipo: Tipo = item?.tipo ?? tipoFixed ?? "video";
  const meta = TIPO_META[tipo];

  // Modo: link ou upload. Vídeo só aceita link. Singletons priorizam upload se aplicável.
  const [mode, setMode] = useState<"link" | "upload">(() => {
    if (!meta.upload) return "link";
    if (item?.url?.startsWith("data:")) return "upload";
    if (item?.url) return "link";
    return meta.upload ? "upload" : "link";
  });
  const [urlInput, setUrlInput] = useState(
    item && !item.url.startsWith("data:") ? item.url : ""
  );
  const [dataUrl, setDataUrl] = useState<string | null>(
    item && item.url.startsWith("data:") ? item.url : null
  );
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fecha o diálogo só quando a action voltar SEM erro.
  useEffect(() => {
    if (submitting && !pending) {
      if (!state?.error && !state?.fieldErrors) {
        onOpenChange(false);
      }
      setSubmitting(false);
    }
  }, [submitting, pending, state, onOpenChange]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !meta.upload) return;
    setBusy(true);
    try {
      // Imagens passam por compressão; PDFs vão crus.
      const url = file.type.startsWith("image/")
        ? await fileToDataUrl(file, { maxDim: 1600, quality: 0.8 })
        : await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(file);
          });
      const maxBytes = meta.upload.maxMB * 1_000_000;
      if (url.length > maxBytes) {
        toast.error(
          `Arquivo grande demais (máximo ~${meta.upload.maxMB}MB). Tente reduzir.`
        );
        setBusy(false);
        return;
      }
      setDataUrl(url);
    } catch {
      toast.error("Não consegui ler o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  function submitHandler(fd: FormData) {
    // Decide o url efetivo conforme o modo.
    const value =
      mode === "upload" && dataUrl ? dataUrl : urlInput.trim();
    fd.set("url", value);
    fd.set("tipo", tipo);
    setSubmitting(true);
    formAction(fd);
  }

  const isPdf = dataUrl?.startsWith("data:application/pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item ? `Editar ${meta.label.toLowerCase()}` : `Adicionar ${meta.label.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>{meta.helper}</DialogDescription>
        </DialogHeader>
        <form action={submitHandler} className="space-y-3">
          <input type="hidden" name="tipo" value={tipo} />

          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              name="titulo"
              placeholder={
                tipo === "rider"
                  ? "Rider técnico — The Rock"
                  : tipo === "presskit"
                    ? "Press kit oficial"
                    : "Nome do material"
              }
              defaultValue={item?.titulo ?? ""}
              required
            />
            <FieldError state={state} name="titulo" />
          </div>

          {/* Toggle Link / Upload */}
          {meta.upload && (
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-1">
              <button
                type="button"
                onClick={() => setMode("link")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium",
                  mode === "link"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent/40"
                )}
              >
                <Link2 className="size-4" />
                Link
              </button>
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium",
                  mode === "upload"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent/40"
                )}
              >
                <Paperclip className="size-4" />
                Arquivo
              </button>
            </div>
          )}

          {mode === "link" ? (
            <div className="space-y-1.5">
              <Label htmlFor="url-input">Link público</Label>
              <Input
                id="url-input"
                type="url"
                placeholder="https://..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                required={mode === "link"}
              />
              <FieldError state={state} name="url" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Arquivo</Label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground hover:bg-muted/40">
                <Paperclip className="size-4" />
                {busy
                  ? "Processando..."
                  : dataUrl
                    ? "Trocar arquivo"
                    : "Escolher arquivo"}
                <input
                  type="file"
                  accept={meta.upload ? meta.upload.accept : undefined}
                  className="hidden"
                  onChange={onPickFile}
                />
              </label>
              {dataUrl &&
                (isPdf ? (
                  <p className="text-sm text-emerald-300 flex items-center gap-1.5">
                    <FileText className="size-4" /> PDF anexado
                  </p>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dataUrl}
                    alt="Pré-visualização"
                    className="max-h-48 w-full rounded-md object-contain border border-border"
                  />
                ))}
              <FieldError state={state} name="url" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              name="descricao"
              rows={2}
              defaultValue={item?.descricao ?? ""}
            />
            <FieldError state={state} name="descricao" />
          </div>

          {state?.error && !state.fieldErrors && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                pending ||
                busy ||
                (mode === "upload" && !dataUrl) ||
                (mode === "link" && !urlInput.trim())
              }
            >
              {pending ? "Salvando..." : item ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
