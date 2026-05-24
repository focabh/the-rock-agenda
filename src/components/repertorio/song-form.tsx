"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { SONG_STATUS_OPTIONS } from "@/components/shared/status-badge";
import type { ActionState } from "@/lib/form";
import type { Song } from "@/db/schema";

export function SongForm({
  song,
  action,
  submitLabel = "Salvar",
}: {
  song?: Song;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="titulo">Música *</Label>
            <Input id="titulo" name="titulo" defaultValue={song?.titulo ?? ""} required autoFocus />
            <FieldError state={state} name="titulo" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="artista">Artista original *</Label>
            <Input id="artista" name="artista" defaultValue={song?.artista ?? ""} required />
            <FieldError state={state} name="artista" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <select
              id="status"
              name="status"
              defaultValue={song?.status ?? "aprendendo"}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              {SONG_STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <FieldError state={state} name="status" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              defaultValue={song?.observacoes ?? ""}
              placeholder="Afinação, tom alternativo, dicas de execução..."
            />
            <FieldError state={state} name="observacoes" />
          </div>

          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
            {state?.error && !state.fieldErrors && (
              <p className="mr-auto text-sm text-destructive">{state.error}</p>
            )}
            <Button render={<Link href="/repertorio" />} variant="outline">
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
