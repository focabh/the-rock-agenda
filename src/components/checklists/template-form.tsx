"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import type { ActionState } from "@/lib/form";
import type { ChecklistTemplate, ChecklistTemplateItem } from "@/db/schema";

export function TemplateForm({
  template,
  items = [],
  action,
  submitLabel = "Salvar",
}: {
  template?: ChecklistTemplate;
  items?: ChecklistTemplateItem[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [draftItems, setDraftItems] = useState<string[]>(
    items.length > 0 ? items.sort((a, b) => a.ordem - b.ordem).map((i) => i.texto) : [""]
  );

  function update(i: number, val: string) {
    setDraftItems((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  }
  function add() {
    setDraftItems((prev) => [...prev, ""]);
  }
  function remove(i: number) {
    setDraftItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={template?.nome ?? ""}
              required
              autoFocus
              placeholder="Ex: Pré-show — Divulgação"
            />
            <FieldError state={state} name="nome" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              name="descricao"
              rows={2}
              defaultValue={template?.descricao ?? ""}
              placeholder="Para que serve essa checklist..."
            />
            <FieldError state={state} name="descricao" />
          </div>

          <div className="space-y-2">
            <Label>Itens</Label>
            <ul className="space-y-2">
              {draftItems.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <Input
                    name="items"
                    value={it}
                    onChange={(e) => update(i, e.target.value)}
                    placeholder={`Item ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => remove(i)}
                    title="Remover"
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="size-4" />
              Adicionar item
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            {state?.error && !state.fieldErrors && (
              <p className="mr-auto text-sm text-destructive">{state.error}</p>
            )}
            <Button render={<Link href="/checklists" />} variant="outline">
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
