"use client";

import { useEffect, useState, useTransition } from "react";
import { FileText, Loader2, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LyricsText } from "@/components/shared/lyrics-text";
import {
  getOrFetchLyricsAction,
  saveLyricsAction,
} from "@/app/(app)/repertorio/actions";

export function LyricsDialog({
  songId,
  titulo,
  artista,
  spotifyTrackId,
  admin,
}: {
  songId: string;
  titulo: string;
  artista: string;
  spotifyTrackId: string | null;
  admin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [found, setFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (!open || loaded) return;
    startLoad(async () => {
      const r = await getOrFetchLyricsAction(songId);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao buscar letra.");
        return;
      }
      setLyrics(r.lyrics);
      setFound(r.found);
      setLoaded(true);
    });
  }, [open, loaded, songId]);

  function startEdit() {
    setDraft(lyrics ?? "");
    setEditing(true);
  }

  function handleSave() {
    startSave(async () => {
      const r = await saveLyricsAction(songId, draft);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao salvar.");
        return;
      }
      setLyrics(r.lyrics);
      setFound(r.found);
      setEditing(false);
      toast.success("Letra salva.");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setEditing(false);
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="shrink-0 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Ver letra"
          />
        }
      >
        <FileText className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{artista}</DialogDescription>
        </DialogHeader>

        {loading && !loaded ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Buscando letra…
          </div>
        ) : editing ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={16}
              className="flex-1 font-mono text-sm"
              placeholder="Cole ou corrija a letra aqui…"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Dica: marque os trechos de <strong>grito/voz forte</strong> entre circunflexos —
              <code className="mx-1 rounded bg-muted px-1">^assim^</code>— que aparecem destacados na letra e no teleprompter.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Salvar letra
              </Button>
            </div>
          </div>
        ) : found && lyrics ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-muted/20 p-4">
              <LyricsText text={lyrics} tone="light" className="text-[15px] leading-relaxed" />
            </div>
            <Footer
              spotifyTrackId={spotifyTrackId}
              admin={admin}
              onEdit={startEdit}
            />
          </>
        ) : (
          <div className="space-y-4 py-6 text-center">
            <p className="text-muted-foreground">
              Letra não encontrada automaticamente pra essa música.
            </p>
            {spotifyTrackId && (
              <SpotifyLink spotifyTrackId={spotifyTrackId} />
            )}
            {admin && (
              <div>
                <Button variant="outline" onClick={startEdit}>
                  <Pencil className="size-4" />
                  Colar letra manualmente
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Footer({
  spotifyTrackId,
  admin,
  onEdit,
}: {
  spotifyTrackId: string | null;
  admin: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <p className="text-xs text-muted-foreground">
        Letra via LRCLIB — pode ter pequenos erros.
      </p>
      <div className="flex items-center gap-2">
        {spotifyTrackId && <SpotifyLink spotifyTrackId={spotifyTrackId} small />}
        {admin && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}

function SpotifyLink({
  spotifyTrackId,
  small,
}: {
  spotifyTrackId: string;
  small?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size={small ? "sm" : "default"}
      render={
        <a
          href={`https://open.spotify.com/track/${spotifyTrackId}`}
          target="_blank"
          rel="noreferrer"
        />
      }
    >
      <ExternalLink className="size-4" />
      Abrir no Spotify
    </Button>
  );
}
