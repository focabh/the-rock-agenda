"use client";

import { useEffect, useState, useTransition } from "react";
import { FileText, Loader2, Pencil, ExternalLink, RefreshCw, ListMusic, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getOrFetchLyricsAction,
  saveLyricsAction,
  refetchLyricsAction,
  searchLyricsVersionsAction,
  applyLyricsVersionAction,
} from "@/app/(app)/repertorio/actions";
import type { LyricsCandidate } from "@/lib/lyrics";
import { versionHint } from "@/lib/song-version";

/** Letra inline na página de detalhe da música (mesma fonte/edição do modal). */
export function LyricsPanel({
  songId,
  titulo = "",
  spotifyTrackId,
  admin,
}: {
  songId: string;
  titulo?: string;
  spotifyTrackId: string | null;
  admin: boolean;
}) {
  const hint = versionHint(titulo);
  const [loaded, setLoaded] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [found, setFound] = useState(false);
  const [manual, setManual] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [refetching, startRefetch] = useTransition();
  // Seletor de versões (ao vivo/estúdio/acústico).
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [candidates, setCandidates] = useState<LyricsCandidate[] | null>(null);
  const [query, setQuery] = useState("");
  const [searching, startSearch] = useTransition();
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [applying, startApply] = useTransition();

  function runSearch(q?: string) {
    startSearch(async () => {
      const r = await searchLyricsVersionsAction(songId, q);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao buscar versões.");
        return;
      }
      setCandidates(r.candidates);
      if (r.candidates.length === 0) toast.info("Nenhuma versão encontrada — tente ajustar a busca.");
    });
  }

  function openVersions() {
    setVersionsOpen(true);
    if (candidates === null) runSearch();
  }

  function applyVersion(id: number) {
    setApplyingId(id);
    startApply(async () => {
      const r = await applyLyricsVersionAction(songId, id);
      setApplyingId(null);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao aplicar a versão.");
        return;
      }
      setLyrics(r.lyrics);
      setFound(r.found);
      setManual(!!r.manual);
      setVersionsOpen(false);
      toast.success("Letra dessa versão aplicada.");
    });
  }

  useEffect(() => {
    startLoad(async () => {
      const r = await getOrFetchLyricsAction(songId);
      if (r.ok) {
        setLyrics(r.lyrics);
        setFound(r.found);
        setManual(!!r.manual);
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
      setManual(!!r.manual);
      setEditing(false);
      toast.success("Letra salva — não será mais sobrescrita automaticamente.");
    });
  }

  function handleRefetch() {
    if (
      !window.confirm(
        "Isso substitui a letra atual pela do LRCLIB e desfaz sua edição manual. Continuar?"
      )
    )
      return;
    startRefetch(async () => {
      const r = await refetchLyricsAction(songId);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao re-buscar a letra.");
        return;
      }
      setLyrics(r.lyrics);
      setFound(r.found);
      setManual(!!r.manual);
      toast.success("Letra re-buscada do LRCLIB.");
    });
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <FileText className="size-3.5" />
          Letra
          {hint && (
            <span
              className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-600 ring-1 ring-inset ring-sky-500/30 dark:text-sky-300"
              title="Versão especial — a letra pode diferir da original. Use “Versões” pra escolher a certa."
            >
              {hint}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {admin && loaded && !editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={openVersions}
              title="Escolher entre versões da letra (ao vivo, acústico, estúdio…)"
            >
              <ListMusic className="size-4" />
              Versões
            </Button>
          )}
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
          {admin && loaded && !editing && manual && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefetch}
              disabled={refetching}
              title="Substituir pela letra do LRCLIB (desfaz a edição manual)"
            >
              {refetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Re-buscar
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

      {versionsOpen && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Escolher versão da letra
            </p>
            <button
              type="button"
              onClick={() => setVersionsOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              fechar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bandas mudam a letra ao vivo. Escolha a versão que vocês tocam — a com{" "}
            <strong>🕑 sincronizada</strong> alimenta o teleprompter no tempo.
          </p>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query.trim() || undefined);
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Refinar busca (ex.: nome da música live, acústico…)"
              className="h-9"
            />
            <Button type="submit" variant="outline" size="sm" disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Buscar
            </Button>
          </form>

          {searching && candidates === null ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Buscando versões…
            </div>
          ) : candidates && candidates.length > 0 ? (
            <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto">
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-3 rounded-md border border-border p-2.5"
                >
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
                    {c.preview && (
                      <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground/80">
                        {c.preview}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={applying}
                    onClick={() => applyVersion(c.id)}
                    className="shrink-0"
                  >
                    {applying && applyingId === c.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Usar
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma versão encontrada. Ajuste a busca acima.
            </p>
          )}
        </Card>
      )}

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
          <>
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
              {lyrics}
            </pre>
            {manual && (
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Pencil className="size-3" /> Editada à mão — não será sobrescrita
                automaticamente.
              </p>
            )}
          </>
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
