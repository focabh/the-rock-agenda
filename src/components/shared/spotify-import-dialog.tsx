"use client";

import {
  importFromSpotifyAction,
  importPastedToRepertorioAction,
  type SpotifyImportResult,
} from "@/app/(app)/repertorio/actions";
import {
  importPastedToSetlistAction,
  importPlaylistToSetlistAction,
  type SpotifyToSetlistResult,
} from "@/app/(app)/shows/[id]/actions-setlist";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BAND } from "@/lib/band";
import { parseTracksFromText } from "@/lib/parse-tracks";
import { cn } from "@/lib/utils";
import {
  ClipboardPaste,
  ExternalLink,
  ListMusic,
  Loader2,
  Music,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

type Props =
  | { mode: "repertorio"; trigger: React.ReactNode }
  | {
      mode: "setlist";
      showId: string;
      setlistId: string;
      trigger: React.ReactNode;
    };

export function SpotifyImportDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>(BAND.spotifyPlaylistUrl as string);
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => parseTracksFromText(text), [text]);

  function showResult(result: SpotifyImportResult | SpotifyToSetlistResult) {
    if (!result.ok) {
      toast.error(result.error ?? "Erro ao importar.");
      return false;
    }
    if (props.mode === "repertorio") {
      const r = result as SpotifyImportResult;
      toast.success(
        `${r.added} nova(s), ${r.existing} já existiam (de ${r.total}).`,
      );
    } else {
      const r = result as SpotifyToSetlistResult;
      const parts = [`${r.added} na setlist`];
      if (r.songsCriadas) parts.push(`${r.songsCriadas} novas no repertório`);
      if (r.duplicados) parts.push(`${r.duplicados} já estavam`);
      toast.success(parts.join(" • "));
    }
    return true;
  }

  function handleTextImport() {
    if (preview.length === 0) {
      toast.error("Nenhuma música detectada no texto.");
      return;
    }
    startTransition(async () => {
      const result =
        props.mode === "repertorio"
          ? await importPastedToRepertorioAction(text)
          : await importPastedToSetlistAction(
              props.showId,
              props.setlistId,
              text,
              replace
            );
      if (showResult(result)) {
        setText("");
        setOpen(false);
      }
    });
  }

  function handleSpotifyImport() {
    if (!url.trim()) return;
    startTransition(async () => {
      const result =
        props.mode === "repertorio"
          ? await importFromSpotifyAction(url)
          : await importPlaylistToSetlistAction(
              props.showId,
              props.setlistId,
              url,
              replace
            );
      if (showResult(result)) setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={props.trigger as React.ReactElement} />
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar músicas</DialogTitle>
          <DialogDescription>
            {props.mode === "repertorio"
              ? "Adiciona ao repertório. Duplicadas (mesmo título + artista) são puladas."
              : "Adiciona à setlist deste show. Cria no repertório o que faltar."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="texto" className="gap-4">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="texto">
              <ClipboardPaste className="size-4" />
              Colar lista
            </TabsTrigger>
            <TabsTrigger value="spotify">
              <Music className="size-4" />
              Spotify API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="texto" className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1.5">
              <p className="font-medium text-foreground">
                Como copiar do Spotify:
              </p>
              <ol className="space-y-0.5 list-decimal list-inside text-muted-foreground">
                <li>
                  Abre a playlist em{" "}
                  <a
                    href={BAND.spotifyPlaylistUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    open.spotify.com <ExternalLink className="size-3" />
                  </a>
                </li>
                <li>
                  Clica na primeira música → <kbd>Ctrl+A</kbd> pra selecionar
                  todas
                </li>
                <li>
                  <kbd>Ctrl+C</kbd> → cola aqui abaixo
                </li>
              </ol>
              <p className="text-muted-foreground pt-1">
                Formato:{" "}
                <code className="text-foreground">Música - Artista</code> (ou
                tab, —, ·, |). Numeração inicial é ignorada.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-tracks">Cole aqui</Label>
              <Textarea
                id="text-tracks"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={
                  "Smells Like Teen Spirit - Nirvana\nKilling in the Name - RATM\nEverlong - Foo Fighters"
                }
                className="font-mono text-xs"
                autoFocus
              />
            </div>

            {preview.length > 0 && (
              <div className="rounded-md border border-border bg-card p-3 space-y-2 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <ListMusic className="size-3.5 text-primary" />
                  Detectadas: {preview.length} música(s)
                </p>
                <ul className="space-y-0.5 text-xs">
                  {preview.slice(0, 30).map((p, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-mono opacity-50 mr-2">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-foreground">{p.titulo}</span>
                      <span className="opacity-60"> — {p.artista}</span>
                    </li>
                  ))}
                  {preview.length > 30 && (
                    <li className="text-muted-foreground italic">
                      ... e mais {preview.length - 30}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {props.mode === "setlist" && preview.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Substituir setlist atual (limpa antes de importar)
              </label>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTextImport}
                disabled={pending || preview.length === 0}
                className={cn(buttonVariants({ variant: "default" }))}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending
                  ? "Importando..."
                  : preview.length > 0
                    ? `Importar ${preview.length}`
                    : "Importar"}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="spotify" className="space-y-4">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90 space-y-1">
              <p className="font-medium">Só playlists públicas</p>
              <p>
                Lê direto da página pública do Spotify — não precisa conectar
                conta. Se a playlist for privada, deixe-a pública no Spotify ou
                use a aba <strong>Colar lista</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spotify-url">URL da playlist</Label>
              <Input
                id="spotify-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
              />
            </div>

            {props.mode === "setlist" && (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Substituir setlist atual
              </label>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <button
                type="button"
                onClick={handleSpotifyImport}
                disabled={pending || !url.trim()}
                className={cn(buttonVariants({ variant: "default" }))}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending ? "Importando..." : "Importar do Spotify"}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
