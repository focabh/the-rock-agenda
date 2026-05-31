"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { Plus, X, GripVertical, Music2, Pencil, Trash2, ListPlus, Wand2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createEnsaioSetlistAction,
  renameEnsaioSetlistAction,
  deleteEnsaioSetlistAction,
  addSongToEnsaioSetlistAction,
  removeEnsaioSetlistItemAction,
  updateEnsaioSetlistItemAction,
  reorderEnsaioSetlistItemsAction,
  reorganizeEnsaioSetlistAction,
} from "@/app/(app)/ensaios/[id]/actions-setlist";
import type { Song, SetlistItem, Setlist } from "@/db/schema";

type Item = SetlistItem & { song: Song };
type SetlistWithItems = Setlist & { items: Item[] };

export function EnsaioSetlistTab({
  rehearsalId,
  setlists,
  allSongs,
  canEdit = true,
}: {
  rehearsalId: string;
  setlists: SetlistWithItems[];
  allSongs: Song[];
  canEdit?: boolean;
}) {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(setlists[0]?.id ?? null);
  const [, startTransition] = useTransition();
  const [mgrPending, startMgr] = useTransition();

  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  useEffect(() => {
    if (setlists.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !setlists.some((s) => s.id === selectedId)) {
      setSelectedId(setlists[0].id);
    }
  }, [setlists, selectedId]);

  const selected = setlists.find((s) => s.id === selectedId) ?? null;
  const sortedItems = useMemo(
    () => (selected ? [...selected.items].sort((a, b) => a.ordem - b.ordem) : []),
    [selected]
  );
  const [localItems, setLocalItems] = useState<Item[]>(sortedItems);
  useEffect(() => setLocalItems(sortedItems), [sortedItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const usedIds = new Set(localItems.map((i) => i.songId));
  const available = allSongs
    .filter((s) => !usedIds.has(s.id))
    .filter((s) => {
      const t = q.trim().toLowerCase();
      if (!t) return true;
      return s.titulo.toLowerCase().includes(t) || s.artista.toLowerCase().includes(t);
    });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localItems.findIndex((i) => i.id === active.id);
    const newIdx = localItems.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(localItems, oldIdx, newIdx);
    setLocalItems(next);
    startTransition(() => reorderEnsaioSetlistItemsAction(rehearsalId, next.map((i) => i.id)));
  }

  function handleCreate(nome: string) {
    startMgr(async () => {
      const r = await createEnsaioSetlistAction(rehearsalId, nome);
      setSelectedId(r.id);
      setNewOpen(false);
      toast.success(`Setlist "${r.nome}" criado.`);
    });
  }
  function handleRename(nome: string) {
    if (!selected) return;
    startMgr(async () => {
      await renameEnsaioSetlistAction(rehearsalId, selected.id, nome);
      setEditOpen(false);
      toast.success("Setlist renomeado.");
    });
  }
  function handleDelete() {
    if (!selected) return;
    startMgr(async () => {
      await deleteEnsaioSetlistAction(rehearsalId, selected.id);
      setDelOpen(false);
      toast.success("Setlist excluído.");
    });
  }
  function handleReorganizar() {
    if (!selected) return;
    startTransition(async () => {
      await reorganizeEnsaioSetlistAction(rehearsalId, selected.id);
      toast.success("Ordenado por curva de energia.");
    });
  }

  if (setlists.length === 0) {
    return (
      <>
        <EmptyState
          icon={ListPlus}
          title="Nenhum setlist de ensaio ainda"
          description={
            canEdit
              ? "Monte o que a banda vai ensaiar (pode ter vários: foco em vocais, músicas novas…)."
              : "Nenhum setlist montado ainda."
          }
          action={
            canEdit && (
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="size-4" /> Novo setlist
              </Button>
            )
          }
        />
        <NameDialog open={newOpen} onOpenChange={setNewOpen} title="Novo setlist de ensaio" placeholder="Ex.: Foco vocais, Músicas novas…" pending={mgrPending} onSubmit={handleCreate} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {setlists.map((sl) => (
          <button
            key={sl.id}
            onClick={() => setSelectedId(sl.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition-colors",
              sl.id === selectedId ? "bg-primary/20 text-primary ring-primary/40" : "ring-border text-muted-foreground hover:bg-accent/50"
            )}
          >
            {sl.nome}
            <span className="opacity-60">({sl.items.length})</span>
          </button>
        ))}
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)} title="Novo setlist">
            <Plus className="size-4" /> Novo
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold inline-flex items-center gap-2">
              {selected?.nome ?? "Setlist"}{" "}
              <span className="text-sm font-normal text-muted-foreground">({localItems.length})</span>
              {canEdit && selected && (
                <>
                  <button onClick={() => setEditOpen(true)} className="text-muted-foreground hover:text-foreground" title="Renomear setlist">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => setDelOpen(true)} className="text-muted-foreground hover:text-destructive" title="Excluir setlist">
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </h3>
            {canEdit && selected && localItems.length > 1 && (
              <Button variant="outline" size="sm" onClick={handleReorganizar} title="Ordenar por curva de energia (grátis)">
                <Wand2 className="size-4" /> Reorganizar
              </Button>
            )}
          </div>

          {localItems.length === 0 ? (
            <EmptyState
              icon={Music2}
              title="Setlist vazio"
              description={canEdit ? "Adicione músicas do repertório ao lado, e arraste pra reordenar." : "Nenhuma música ainda."}
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y divide-border">
                    {localItems.map((item, idx) => (
                      <SortableItem key={item.id} item={item} index={idx} rehearsalId={rehearsalId} canEdit={canEdit} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </Card>
          )}
        </div>

        {canEdit && selected && (
          <div className="space-y-3">
            <h3 className="font-semibold">Adicionar do repertório</h3>
            <Input placeholder="Buscar música ou artista..." value={q} onChange={(e) => setQ(e.target.value)} />
            <Card className="max-h-[70vh] overflow-y-auto p-0">
              {available.length === 0 ? (
                <p className="p-6 text-sm text-center text-muted-foreground">
                  {q ? "Nada encontrado." : "Todas as músicas já estão neste setlist."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {available.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.titulo}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.artista}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Adicionar"
                        onClick={() => startTransition(() => addSongToEnsaioSetlistAction(rehearsalId, selected.id, s.id))}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>

      <NameDialog open={newOpen} onOpenChange={setNewOpen} title="Novo setlist de ensaio" placeholder="Ex.: Foco vocais, Músicas novas…" pending={mgrPending} onSubmit={handleCreate} />
      <NameDialog open={editOpen} onOpenChange={setEditOpen} title="Renomear setlist" placeholder="Nome do setlist" initial={selected?.nome ?? ""} pending={mgrPending} onSubmit={handleRename} />
      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o setlist “{selected?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>As músicas continuam no repertório — só este setlist é removido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancelar</AlertDialogCancel>
            <AlertDialogAction render={<Button variant="destructive" disabled={mgrPending} />} onClick={handleDelete}>
              {mgrPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NameDialog({
  open,
  onOpenChange,
  title,
  placeholder,
  initial = "",
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  placeholder?: string;
  initial?: string;
  pending: boolean;
  onSubmit: (nome: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Dê um nome pra identificar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => value.trim() && onSubmit(value.trim())} disabled={pending || !value.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortableItem({ item, index, rehearsalId, canEdit }: { item: Item; index: number; rehearsalId: string; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canEdit });
  const [, startTransition] = useTransition();
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={cn("px-3 py-2 flex items-center gap-2 bg-card", isDragging && "z-10 shadow-lg ring-1 ring-primary/40")}>
      {canEdit && (
        <button {...attributes} {...listeners} className="shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none" title="Arrastar para reordenar" aria-label="Arrastar">
          <GripVertical className="size-4" />
        </button>
      )}
      <span className="w-6 text-right text-sm font-mono text-muted-foreground">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.song.titulo}</p>
        <p className="text-xs text-muted-foreground truncate">{item.song.artista}</p>
      </div>
      {item.song.dropada && (
        <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-amber-500/30 bg-amber-500/10 text-amber-300" title="Afinação dropada">
          DROP
        </span>
      )}
      <Input
        defaultValue={item.tom ?? item.song.tom ?? ""}
        placeholder="Tom"
        title="Tom (tonalidade)"
        disabled={!canEdit}
        className="w-16 h-7 text-xs font-mono"
        onBlur={(e) => canEdit && startTransition(() => updateEnsaioSetlistItemAction(rehearsalId, item.id, { tom: e.target.value || null }))}
      />
      {canEdit && (
        <Button variant="ghost" size="icon" title="Remover" className="text-muted-foreground hover:text-destructive" onClick={() => startTransition(() => removeEnsaioSetlistItemAction(rehearsalId, item.id))}>
          <X className="size-3.5" />
        </Button>
      )}
    </li>
  );
}
