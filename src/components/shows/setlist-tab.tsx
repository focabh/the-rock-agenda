"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, X, GripVertical, Printer, Music2, Download } from "lucide-react";
import { SpotifyImportDialog } from "@/components/shared/spotify-import-dialog";
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
import { EmptyState } from "@/components/shared/empty-state";
import { formatDuracao } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  addSongToSetlistAction,
  removeSetlistItemAction,
  updateSetlistItemAction,
  reorderSetlistItemsAction,
} from "@/app/(app)/shows/[id]/actions-setlist";
import type { Song, SetlistItem } from "@/db/schema";

type Item = SetlistItem & { song: Song };

export function SetlistTab({
  showId,
  items,
  allSongs,
  canEdit = true,
}: {
  showId: string;
  items: Item[];
  allSongs: Song[];
  canEdit?: boolean;
}) {
  const [q, setQ] = useState("");
  const [, startTransition] = useTransition();

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.ordem - b.ordem),
    [items]
  );

  // estado otimista — segue o servidor mas permite reordenar localmente sem flicker
  const [localItems, setLocalItems] = useState<Item[]>(sortedItems);
  useEffect(() => {
    setLocalItems(sortedItems);
  }, [sortedItems]);

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
      return (
        s.titulo.toLowerCase().includes(t) ||
        s.artista.toLowerCase().includes(t)
      );
    });

  const totalSeg = localItems.reduce((s, i) => s + (i.duracaoSeg ?? 0), 0);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localItems.findIndex((i) => i.id === active.id);
    const newIdx = localItems.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(localItems, oldIdx, newIdx);
    setLocalItems(next);
    startTransition(() =>
      reorderSetlistItemsAction(
        showId,
        next.map((i) => i.id)
      )
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Coluna 1 — setlist atual */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            Setlist ({localItems.length})
            {totalSeg > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ~ {formatDuracao(totalSeg)}
              </span>
            )}
          </h3>
          <div className="flex gap-2">
            {canEdit && (
              <SpotifyImportDialog
                mode="setlist"
                showId={showId}
                trigger={
                  <Button variant="outline" size="sm">
                    <Download className="size-4" />
                    Spotify
                  </Button>
                }
              />
            )}
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/shows/${showId}/imprimir-setlist`}
                  target="_blank"
                />
              }
            >
              <Printer className="size-4" />
              Imprimir
            </Button>
          </div>
        </div>

        {localItems.length === 0 ? (
          <EmptyState
            icon={Music2}
            title="Setlist vazia"
            description={
              canEdit
                ? "Adicione músicas do repertório ao lado, e arraste pra reordenar."
                : "Nenhuma música nesta setlist ainda."
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={localItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="divide-y divide-border">
                  {localItems.map((item, idx) => (
                    <SortableSetlistItem
                      key={item.id}
                      item={item}
                      index={idx}
                      showId={showId}
                      canEdit={canEdit}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </Card>
        )}
      </div>

      {/* Coluna 2 — adicionar do repertório */}
      {canEdit && (
        <div className="space-y-3">
          <h3 className="font-semibold">Adicionar do repertório</h3>
          <Input
            placeholder="Buscar música ou artista..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Card className="overflow-hidden p-0 max-h-[600px] overflow-y-auto">
            {available.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted-foreground">
                {q
                  ? "Nada encontrado."
                  : "Todas as músicas já estão na setlist."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {available.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.artista}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Adicionar"
                      onClick={() =>
                        startTransition(() =>
                          addSongToSetlistAction(showId, s.id)
                        )
                      }
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
  );
}

function SortableSetlistItem({
  item,
  index,
  showId,
  canEdit,
}: {
  item: Item;
  index: number;
  showId: string;
  canEdit: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canEdit });

  const [, startTransition] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-3 py-2 flex items-center gap-2 bg-card",
        isDragging && "z-10 shadow-lg ring-1 ring-primary/40"
      )}
    >
      {canEdit && (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          title="Arrastar para reordenar"
          aria-label="Arrastar"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <span className="w-6 text-right text-sm font-mono text-muted-foreground">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.song.titulo}</p>
        <p className="text-xs text-muted-foreground truncate">
          {item.song.artista}
        </p>
      </div>
      <Input
        defaultValue={item.tom ?? ""}
        placeholder="Tom"
        disabled={!canEdit}
        className="w-16 h-7 text-xs font-mono"
        onBlur={(e) =>
          canEdit &&
          startTransition(() =>
            updateSetlistItemAction(showId, item.id, {
              tom: e.target.value || null,
            })
          )
        }
      />
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          title="Remover"
          className="text-muted-foreground hover:text-destructive"
          onClick={() =>
            startTransition(() => removeSetlistItemAction(showId, item.id))
          }
        >
          <X className="size-3.5" />
        </Button>
      )}
    </li>
  );
}
