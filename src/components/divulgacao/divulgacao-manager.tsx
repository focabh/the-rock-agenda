"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Video,
  Image as ImageIcon,
  FileText,
  Download,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
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
import {
  createPromoAction,
  updatePromoAction,
  deletePromoAction,
} from "@/app/(app)/divulgacao/actions";
import { toast } from "sonner";

type Tipo = "video" | "foto" | "logo" | "presskit";

export type PromoLite = {
  id: string;
  tipo: Tipo;
  titulo: string;
  url: string;
  descricao: string | null;
};

const TIPO_META: Record<
  Tipo,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    helper: string;
  }
> = {
  video: {
    label: "Vídeos",
    icon: Video,
    helper: "YouTube, Vimeo, Instagram, Google Drive...",
  },
  foto: {
    label: "Fotos",
    icon: ImageIcon,
    helper: "Pasta no Drive, Instagram, Imgur...",
  },
  logo: {
    label: "Logo",
    icon: Download,
    helper: "Link de download (PNG/SVG no Drive).",
  },
  presskit: {
    label: "Press kit",
    icon: FileText,
    helper: "PDF público do press kit.",
  },
};

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
  };
  for (const i of items) byTipo[i.tipo].push(i);

  return (
    <div className="space-y-6">
      {(Object.keys(TIPO_META) as Tipo[]).map((tipo) => {
        const meta = TIPO_META[tipo];
        const list = byTipo[tipo];
        const Icon = meta.icon;
        return (
          <section key={tipo} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                {meta.label}{" "}
                {list.length > 0 && (
                  <span className="text-sm text-muted-foreground font-normal">
                    ({list.length})
                  </span>
                )}
              </h2>
              {admin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingTipo(tipo)}
                >
                  <Plus className="size-4" /> Adicionar
                </Button>
              )}
            </div>

            {list.length === 0 ? (
              <Card>
                <CardContent className="py-5">
                  <p className="text-sm text-muted-foreground">
                    Nada por aqui ainda. {admin && meta.helper}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-0 overflow-hidden">
                <ul className="divide-y divide-border">
                  {list.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center gap-3 px-5 py-3"
                    >
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
                            onClick={() => setEditing(i)}
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
            )}
          </section>
        );
      })}

      {items.length === 0 && admin && (
        <EmptyState
          icon={Plus}
          title="Comece adicionando seu primeiro material"
          description="Vídeos, fotos, logo e press kit ficam disponíveis pra toda a banda compartilhar."
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

function DeleteBtn({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar material" : "Adicionar material"}
          </DialogTitle>
          <DialogDescription>
            Cole o link público (Drive, YouTube, Instagram, etc.).
          </DialogDescription>
        </DialogHeader>
        <form
          action={(fd) => {
            formAction(fd);
            // Otimismo: fecha o diálogo após enviar; revalidatePath atualiza a lista.
            setTimeout(() => {
              if (!state?.error && !state?.fieldErrors) onOpenChange(false);
            }, 300);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              name="tipo"
              defaultValue={item?.tipo ?? tipoFixed ?? "video"}
              className={selectCls}
              required
              disabled={Boolean(tipoFixed) && !item}
            >
              {(Object.keys(TIPO_META) as Tipo[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_META[t].label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              name="titulo"
              placeholder="Ex.: Vídeo no Vila Rock — set completo"
              defaultValue={item?.titulo ?? ""}
              required
            />
            <FieldError state={state} name="titulo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://..."
              defaultValue={item?.url ?? ""}
              required
            />
            <FieldError state={state} name="url" />
          </div>
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
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : item ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
