"use client";

import { useEffect, useState, useTransition } from "react";
import { FileText, Loader2, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getOrFetchLyricsAction,
  saveLyricsAction,
} from "@/app/(app)/repertorio/actions";

/** Letra inline na página de detalhe da música (mesma fonte/edição do modal). */
export function LyricsPanel({
  songId,
  spotifyTrackId,
  admin,
}: {
  songId: string;
  spotifyTrackId: string | null;
  admin: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [found, setFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    startLoad(async () => {
      const r = await getOrFetchLyricsAction(songId);
      if (r.ok) {
        setLyrics(r.lyrics);
        setFound(r.found);
      }
      setLoaded(true);
    });
  }, [songId]);

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
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <FileText className="size-3.5" />
          Letra
        </h2>
        <div className="flex items-center gap-2">
          {spotifyTrackId && (
            <Button
              variant="ghost"
              size="sm"
              render={
                <a
                  href={`https://open.spotify.com/track/${spotifyTrackId}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink className="size-4" />
              Spotify
            </Button>
          )}
          {admin && loaded && !editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(lyrics ?? "");
                setEditing(true);
              }}
            >
              <Pencil className="size-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        {!loaded && loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Buscando letra…
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
              className="font-mono text-sm"
              placeholder="Cole ou corrija a letra aqui…"
              autoFocus
            />
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
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
            {lyrics}
          </pre>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <p>Letra não encontrada automaticamente.</p>
            {admin && (
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setDraft("");
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" />
                Colar letra manualmente
              </Button>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
