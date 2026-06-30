"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  listSetlistsForReuseAction,
  type ReusableSetlist,
} from "@/app/(app)/shows/[id]/actions-setlist";

/**
 * "Novo setlist": começar EM BRANCO ou COPIAR de um setlist salvo (reaproveitar).
 * Lista todos os setlists salvos (show e ensaio) pra escolher.
 */
export function SetlistReuseDialog({
  open,
  onOpenChange,
  pending,
  onCreateEmpty,
  onClone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pending: boolean;
  onCreateEmpty: (nome: string) => void;
  onClone: (sourceId: string, nome: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [sourceId, setSourceId] = useState(""); // "" = em branco
  const [saved, setSaved] = useState<ReusableSetlist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setNome("");
      setSourceId("");
      return;
    }
    setLoading(true);
    listSetlistsForReuseAction()
      .then((r) => setSaved(r))
      .finally(() => setLoading(false));
  }, [open]);

  function submit() {
    if (sourceId) onClone(sourceId, nome.trim());
    else onCreateEmpty(nome.trim() || "Setlist");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo setlist</DialogTitle>
          <DialogDescription>
            Comece em branco ou copie as músicas de um setlist salvo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sl-source">Começar de</Label>
            <select
              id="sl-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              disabled={loading || pending}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Em branco</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>
                  Copiar de: {s.label}
                </option>
              ))}
            </select>
            {loading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> carregando setlists salvos…
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="sl-nome">Nome {sourceId && "(vazio = mantém o do original)"}</Label>
            <Input
              id="sl-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: 1º set, Bis, Acústico…"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || loading}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {sourceId ? "Copiar setlist" : "Criar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
