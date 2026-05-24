"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X, ClipboardCheck, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import {
  applyChecklistTemplateAction,
  toggleChecklistItemAction,
  addChecklistItemAction,
  removeChecklistItemAction,
  removeShowChecklistAction,
} from "@/app/(app)/shows/[id]/actions-checklist";
import type {
  ChecklistTemplate,
  ShowChecklist,
  ShowChecklistItem,
} from "@/db/schema";

type ShowChecklistWithItems = ShowChecklist & {
  items: ShowChecklistItem[];
  template?: ChecklistTemplate | null;
};

export function ChecklistTab({
  showId,
  templates,
  checklists,
}: {
  showId: string;
  templates: ChecklistTemplate[];
  checklists: ShowChecklistWithItems[];
}) {
  const [, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const usedTemplateIds = new Set(checklists.map((c) => c.templateId));
  const available = templates.filter((t) => !usedTemplateIds.has(t.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Checklists do show</h3>
          <p className="text-sm text-muted-foreground">
            Aplique templates ou adicione itens avulsos.
          </p>
        </div>
        {available.length > 0 && (
          <div className="relative">
            <Button onClick={() => setPickerOpen((v) => !v)}>
              <Plus className="size-4" />
              Aplicar template
            </Button>
            {pickerOpen && (
              <Card className="absolute right-0 mt-1 w-64 z-10 p-0">
                <ul className="divide-y divide-border">
                  {available.map((t) => (
                    <li key={t.id}>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                        onClick={() => {
                          setPickerOpen(false);
                          startTransition(() =>
                            applyChecklistTemplateAction(showId, t.id)
                          );
                        }}
                      >
                        {t.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>

      {checklists.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma checklist aplicada"
          description={
            templates.length === 0
              ? "Você ainda não tem templates de checklist. Crie um primeiro."
              : "Comece aplicando um template do menu acima."
          }
          action={
            templates.length === 0 ? (
              <Button render={<Link href="/checklists/novo" />}>
                <Plus className="size-4" /> Criar template
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {checklists.map((c) => (
            <ChecklistCard key={c.id} showId={showId} checklist={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistCard({
  showId,
  checklist,
}: {
  showId: string;
  checklist: ShowChecklistWithItems;
}) {
  const [novoItem, setNovoItem] = useState("");
  const [, startTransition] = useTransition();
  const itemsSorted = [...checklist.items].sort((a, b) => a.ordem - b.ordem);
  const done = itemsSorted.filter((i) => i.concluido).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">
            {checklist.template?.nome ?? "Checklist"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {done} / {itemsSorted.length} concluídos
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          title="Remover checklist"
          onClick={() =>
            startTransition(() => removeShowChecklistAction(showId, checklist.id))
          }
        >
          <Trash2 className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1">
          {itemsSorted.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 group/item rounded px-1 -mx-1 hover:bg-accent/30"
            >
              <input
                type="checkbox"
                checked={it.concluido}
                onChange={(e) =>
                  startTransition(() =>
                    toggleChecklistItemAction(showId, it.id, e.target.checked)
                  )
                }
                className="size-4 accent-primary cursor-pointer"
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  it.concluido && "line-through text-muted-foreground"
                )}
              >
                {it.texto}
              </span>
              <button
                onClick={() =>
                  startTransition(() => removeChecklistItemAction(showId, it.id))
                }
                className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition"
                title="Remover"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!novoItem.trim()) return;
            const texto = novoItem;
            setNovoItem("");
            startTransition(() =>
              addChecklistItemAction(showId, checklist.id, texto)
            );
          }}
          className="flex gap-2 pt-2 border-t border-border"
        >
          <Input
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            placeholder="Adicionar item..."
            className="h-8 text-sm"
          />
          <Button type="submit" size="sm" variant="outline">
            <Plus className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
