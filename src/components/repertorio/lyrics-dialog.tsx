"use client";

import { useEffect, useState, useTransition } from "react";
import { FileText, Loader2, Pencil, ExternalLink, Megaphone } from "lucide-react";
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
import { useOffline } from "@/lib/offline/store";
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

  // Local-first: a letra cacheada no snapshot offline. Se já tiver, usa na hora
  // (instantâneo e funciona sem internet); senão cai pra rede (quando online).
  const cachedLyrics = useOffline(
    (s) => s.snapshot?.songs.find((x) => x.id === songId)?.lyrics ?? null
  );
  const online = useOffline((s) => s.online);

  useEffect(() => {
    if (!open || loaded) return;
    // 1) letra no snapshot → resolve offline, sem rede
    if (cachedLyrics) {
      setLyrics(cachedLyrics);
      setFound(true);
      setLoaded(true);
      return;
    }
    // 2) offline e sem letra cacheada → nada a buscar
    if (!online) {
      setLyrics(null);
      setFound(false);
      setLoaded(true);
      return;
    }
    // 3) online → busca/cacheia na fonte (LRCLIB)
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
  }, [open, loaded, songId, cachedLyrics, online]);

  function startEdit() {
    setDraft(lyrics ?? "");
    setEditing(true);
  }

  // Envolve o trecho selecionado com ^...^ (marca de grito). Sem seleção, insere
  // ^^ e deixa o cursor no meio.
  function marcarGrito() {
    const ta = document.getElementById("lyrics-edit-ta") as HTMLTextAreaElement | null;
    if (!ta) return;
    const s = ta.selectionStart ?? draft.length;
    const e = ta.selectionEnd ?? draft.length;
    const sel = draft.slice(s, e);
    const wrapped = sel ? `^${sel}^` : "^^";
    const next = draft.slice(0, s) + wrapped + draft.slice(e);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = sel ? s + wrapped.length : s + 1;
      ta.setSelectionRange(pos, pos);
    });
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
              id="lyrics-edit-ta"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={16}
              className="flex-1 font-mono text-sm"
              placeholder="Cole ou corrija a letra aqui…"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={marcarGrito} title="Selecione o trecho e marque como grito">
                <Megaphone className="size-4" /> Marcar grito
              </Button>
              <p className="text-xs text-muted-foreground">
                Selecione o trecho de <strong>voz forte/grito</strong> e clique — fica em destaque na letra e no teleprompter.
              </p>
            </div>
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
