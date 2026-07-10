"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, Plus } from "lucide-react";
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
  enrichSongAfterAddAction,
} from "@/app/(app)/repertorio/actions";
import type { TrackHit } from "@/lib/song-search";

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
  const [candidates, setCandidates] = useState<TrackHit[]>([]);
  const [searching, startSearch] = useTransition();
  const [addingIdx, setAddingIdx] = useState<number | null>(null);
  const [adding, startAdd] = useTransition();
  const seq = useRef(0);

  // Busca conforme digita (debounce 300ms, metadados leves). Ignora respostas
  // fora de ordem.
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
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Limpa ao fechar.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCandidates([]);
      setAddingIdx(null);
    }
  }, [open]);

  function add(c: TrackHit, idx: number) {
    setAddingIdx(idx);
    startAdd(async () => {
      const r = await addSongByNameAction({
        titulo: c.titulo,
        artista: c.artista,
        durationSec: c.durationSec,
      });
      setAddingIdx(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      // Letra + BPM em SEGUNDO PLANO (não trava a UI).
      if (!r.already) void enrichSongAfterAddAction(r.id).catch(() => {});
      toast.success(
        r.already ? `Já estava no repertório: ${r.titulo}` : `Adicionada: ${r.titulo} — letra e BPM chegando…`
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
            Digite o nome (e artista) da música. Adiciona na hora; a{" "}
            <strong>letra sincronizada e o BPM</strong> chegam em segundo plano.
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
            candidates.map((c, idx) => (
              <div key={`${c.titulo}|${c.artista}|${idx}`} className="flex items-center gap-2 rounded-md border border-border p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.titulo}
                    <span className="text-muted-foreground"> · {c.artista}</span>
                  </p>
                  {c.durationSec != null && (
                    <p className="truncate text-xs text-muted-foreground">
                      {Math.floor(c.durationSec / 60)}:{String(c.durationSec % 60).padStart(2, "0")}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" disabled={adding} onClick={() => add(c, idx)} className="shrink-0">
                  {adding && addingIdx === idx ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
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
