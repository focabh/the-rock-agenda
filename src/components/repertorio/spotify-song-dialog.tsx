"use client";

import { useState, useTransition } from "react";
import { Loader2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addSongFromSpotifyAction } from "@/app/(app)/repertorio/actions";

export function SpotifySongDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();

  function add() {
    if (!url.trim()) return;
    start(async () => {
      const r = await addSongFromSpotifyAction(url);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.already
          ? `Já estava no repertório: ${r.titulo}`
          : `Adicionada: ${r.titulo} — ${r.artista}`
      );
      setUrl("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar música do Spotify</DialogTitle>
          <DialogDescription>
            Cole o link de <strong>uma</strong> música. Eu puxo título, artista e
            duração — e ainda tento letra e BPM automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="track-url">Link da música</Label>
          <Input
            id="track-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/track/..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <p className="text-xs text-muted-foreground">
            No Spotify: <kbd>⋯</kbd> na música → Compartilhar → Copiar link da
            música.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={add} disabled={pending || !url.trim()}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Music className="size-4" />
            )}
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
