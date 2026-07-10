"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  searchAddCandidatesAction,
  addSongByNameAction,
} from "@/app/(app)/repertorio/actions";
import type { LyricsCandidate } from "@/lib/lyrics";

/**
 * "Adicionar por nome": digita a música, busca no LRCLIB (grátis) e cria já com
 * letra + letra sincronizada + duração (e busca BPM). Serve no repertório e no
 * setlist — quando `onAdded` é passado, o chamador decide o que fazer com o id
 * (ex.: adicionar ao setlist).
 */
export function AddByNameDialog({
  open,
  onOpenChange,
  onAdded,
  title = "Adicionar por nome",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (songId: string, titulo: string) => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<LyricsCandidate[]>([]);
  const [searching, startSearch] = useTransition();
  const [addingId, setAddingId] = useState<number | null>(null);
  const [adding, startAdd] = useTransition();
  const seq = useRef(0);

  // Busca conforme digita (debounce 450ms). Ignora respostas fora de ordem.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      startSearch(async () => {
        const r = await searchAddCandidatesAction(q);
        if (mine === seq.current) setCandidates(r);
      });
    }, 450);
    return () => clearTimeout(t);
  }, [query]);

  // Limpa ao fechar.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCandidates([]);
      setAddingId(null);
    }
  }, [open]);

  function add(c: LyricsCandidate) {
    setAddingId(c.id);
    startAdd(async () => {
      const r = await addSongByNameAction({
        titulo: c.trackName,
        artista: c.artistName,
        lrclibId: c.id,
        durationSec: c.durationSec,
      });
      setAddingId(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.already ? `Já estava no repertório: ${r.titulo}` : `Adicionada: ${r.titulo} — ${r.artista}`
      );
      onAdded?.(r.id, r.titulo);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Digite o nome (e artista) da música. Eu busco e já trago{" "}
            <strong>letra, letra sincronizada e duração</strong> — e busco o BPM.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: zombie cranberries"
            autoFocus
            className="pl-8"
          />
        </div>

        <div className="max-h-[55vh] min-h-24 space-y-1.5 overflow-y-auto">
          {searching && candidates.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Buscando…
            </div>
          ) : query.trim().length < 2 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Comece a digitar pra buscar.
            </p>
          ) : candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nada encontrado. Tente incluir o artista.
            </p>
          ) : (
            candidates.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.trackName}
                    <span className="text-muted-foreground"> · {c.artistName}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.albumName ? `${c.albumName} · ` : ""}
                    {c.durationSec != null
                      ? `${Math.floor(c.durationSec / 60)}:${String(c.durationSec % 60).padStart(2, "0")} · `
                      : ""}
                    {c.hasSynced ? "🕑 sincronizada" : "texto"}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={adding} onClick={() => add(c)} className="shrink-0">
                  {adding && addingId === c.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : c.hasSynced ? (
                    <Check className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Adicionar
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
