"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Star,
  Pencil,
  Music2,
  Users,
  ChevronDown,
  CheckSquare,
  Trash2,
  X,
  Play,
  ExternalLink,
  Guitar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SongStatusBadge,
  SONG_STATUS_OPTIONS,
} from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { LyricsDialog } from "@/components/repertorio/lyrics-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Song, Member } from "@/db/schema";
import {
  deleteSongAction,
  toggleFavoritaAction,
  bulkDeleteSongsAction,
  bulkSetStatusAction,
  bulkSetFavoritaAction,
} from "@/app/(app)/repertorio/actions";

type ReadinessMap = Record<string, Record<string, string>>;
type Readiness = "pronta" | "precisa_ensaiar" | "aprendendo";

const READINESS_DOT: Record<Readiness, string> = {
  pronta: "bg-emerald-400",
  precisa_ensaiar: "bg-amber-400",
  aprendendo: "bg-blue-400",
};

const READINESS_LABEL: Record<Readiness, string> = {
  pronta: "Pronta",
  precisa_ensaiar: "Precisa ensaiar",
  aprendendo: "Aprendendo",
};

export function SongList({
  songs,
  admin = true,
  members = [],
  readinessBySong = {},
  userPosicao = null,
}: {
  songs: Song[];
  admin?: boolean;
  members?: Member[];
  readinessBySong?: ReadinessMap;
  /** Posição do usuário logado (Vocal/Guitarra/Baixo/…) — habilita atalhos por instrumento. */
  userPosicao?: string | null;
}) {
  // Instrumentista vê atalho de Cifra/Tab (Cifra Club). Vocal/Manager não.
  const showCifra =
    !!userPosicao && !/vocal|manager/i.test(userPosicao);
  const [q, setQ] = useState("");
  // Multi-seleção de status — se vazio, tudo passa
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set()
  );
  const [onlyFav, setOnlyFav] = useState(false);
  // Filtrar por músico: "atrasados de Fulano"
  const [memberFilter, setMemberFilter] = useState<string>(""); // memberId
  const [memberStatusFilter, setMemberStatusFilter] =
    useState<string>("nao_pronta"); // "nao_pronta" | readiness
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Player do Spotify aberto (um por vez)
  const [playingId, setPlayingId] = useState<string | null>(null);
  // Card expandido no mobile (accordion) — só afeta telas pequenas
  const [mobileOpen, setMobileOpen] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Modo seleção / ações em massa (só admin)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function memberReadiness(songId: string, memberId: string): Readiness {
    return (readinessBySong[songId]?.[memberId] as Readiness) ?? "aprendendo";
  }

  function readyCount(songId: string): number {
    return members.filter(
      (m) => memberReadiness(songId, m.id) === "pronta"
    ).length;
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return songs.filter((s) => {
      if (selectedStatuses.size > 0 && !selectedStatuses.has(s.status))
        return false;
      if (onlyFav && !s.favorita) return false;
      if (
        term &&
        !s.titulo.toLowerCase().includes(term) &&
        !s.artista.toLowerCase().includes(term)
      )
        return false;
      if (memberFilter) {
        const r = memberReadiness(s.id, memberFilter);
        if (memberStatusFilter === "nao_pronta") {
          if (r === "pronta") return false;
        } else if (r !== memberStatusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [songs, q, selectedStatuses, onlyFav, memberFilter, memberStatusFilter]);

  function handleToggleFav(id: string, current: boolean) {
    startTransition(() => toggleFavoritaAction(id, !current));
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  function toggleSelectAll() {
    setSelectedIds(
      allFilteredSelected ? new Set() : new Set(filtered.map((s) => s.id))
    );
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    const target = [...selectedIds];
    startBulk(async () => {
      const r = await bulkDeleteSongsAction(target);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao remover.");
        return;
      }
      toast.success(`${r.count} música(s) removida(s).`);
      setConfirmDeleteOpen(false);
      exitSelectMode();
    });
  }

  function handleBulkStatus(status: string) {
    if (!status) return;
    const target = [...selectedIds];
    startBulk(async () => {
      const r = await bulkSetStatusAction(target, status as Song["status"]);
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao mudar status.");
        return;
      }
      toast.success(`Status atualizado em ${r.count} música(s).`);
      exitSelectMode();
    });
  }

  function handleBulkFav(favorita: boolean) {
    const target = [...selectedIds];
    startBulk(async () => {
      const r = await bulkSetFavoritaAction(target, favorita);
      if (!r.ok) {
        toast.error(r.error ?? "Erro.");
        return;
      }
      toast.success(
        favorita
          ? `${r.count} música(s) favoritada(s).`
          : `${r.count} desfavoritada(s).`
      );
      exitSelectMode();
    });
  }

  function toggleMobileOpen(id: string) {
    setMobileOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Cluster de ações da música — usado inline no desktop e dentro do accordion
  // no mobile. Renderizado nos dois lugares (visibilidade via CSS).
  function renderActions(s: Song) {
    const ready = readyCount(s.id);
    const total = members.length;
    const allReady = total > 0 && ready === total;
    const isExpanded = expanded.has(s.id);
    return (
      <>
        {total > 0 && (
          <button
            onClick={() => toggleExpanded(s.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
              allReady
                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/25"
                : "bg-amber-500/15 text-amber-300 ring-amber-500/30 hover:bg-amber-500/25"
            )}
            title="Ver status por músico"
          >
            <Users className="size-3" />
            {ready}/{total}
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </button>
        )}

        {s.spotifyTrackId && (
          <button
            onClick={() => setPlayingId(playingId === s.id ? null : s.id)}
            className={cn(
              "shrink-0 inline-flex size-8 items-center justify-center rounded-full transition-colors",
              playingId === s.id
                ? "bg-primary text-primary-foreground"
                : "text-primary hover:bg-primary/15"
            )}
            title={playingId === s.id ? "Fechar player" : "Tocar no Spotify"}
          >
            {playingId === s.id ? (
              <X className="size-4" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </button>
        )}

        {s.spotifyTrackId && (
          <a
            href={`https://open.spotify.com/track/${s.spotifyTrackId}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex size-8 items-center justify-center rounded-full text-emerald-400 transition-colors hover:bg-emerald-500/15"
            title="Abrir no Spotify (toca inteira no app, ideal no celular)"
          >
            <ExternalLink className="size-4" />
          </a>
        )}

        <LyricsDialog
          songId={s.id}
          titulo={s.titulo}
          artista={s.artista}
          spotifyTrackId={s.spotifyTrackId}
          admin={admin}
        />

        {showCifra && (
          <a
            href={`https://www.cifraclub.com.br/?q=${encodeURIComponent(
              `${s.artista} ${s.titulo}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex size-8 items-center justify-center rounded-full text-orange-400 transition-colors hover:bg-orange-500/15"
            title="Cifra / tab no Cifra Club"
          >
            <Guitar className="size-4" />
          </a>
        )}

        {admin && (
          <>
            <Button
              variant="ghost"
              size="icon"
              render={<Link href={`/repertorio/${s.id}`} />}
              title="Editar"
            >
              <Pencil className="size-4" />
            </Button>
            <DeleteButton
              itemName={s.titulo}
              action={deleteSongAction.bind(null, s.id)}
            />
          </>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Buscar por música ou artista..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="md:max-w-sm"
          />
          <Button
            variant={onlyFav ? "default" : "outline"}
            onClick={() => setOnlyFav((v) => !v)}
          >
            <Star className={cn("size-4", onlyFav && "fill-current")} />
            Favoritas
          </Button>
          {admin && (
            <Button
              variant={selectMode ? "default" : "outline"}
              onClick={() =>
                selectMode ? exitSelectMode() : setSelectMode(true)
              }
            >
              {selectMode ? (
                <X className="size-4" />
              ) : (
                <CheckSquare className="size-4" />
              )}
              {selectMode ? "Sair" : "Selecionar"}
            </Button>
          )}
          <div className="ml-auto self-center text-sm text-muted-foreground">
            {filtered.length} / {songs.length}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
            Status:
          </span>
          {SONG_STATUS_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => toggleStatus(value)}
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                selectedStatuses.has(value)
                  ? "bg-primary/20 text-primary-foreground ring-primary/40"
                  : "ring-border text-muted-foreground hover:bg-accent/50"
              )}
            >
              {label}
            </button>
          ))}
          {selectedStatuses.size > 0 && (
            <button
              onClick={() => setSelectedStatuses(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              limpar
            </button>
          )}
        </div>

        {members.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1 inline-flex items-center gap-1">
              <Users className="size-3" />
              Por músico:
            </span>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="flex h-7 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              <option value="">— todos —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            {memberFilter && (
              <>
                <select
                  value={memberStatusFilter}
                  onChange={(e) => setMemberStatusFilter(e.target.value)}
                  className="flex h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="nao_pronta">não está pronto</option>
                  <option value="aprendendo">aprendendo</option>
                  <option value="precisa_ensaiar">precisa ensaiar</option>
                  <option value="pronta">pronta</option>
                </select>
                <button
                  onClick={() => setMemberFilter("")}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  limpar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {selectMode && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/40 bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs text-primary hover:underline"
          >
            {allFilteredSelected
              ? "Limpar seleção"
              : `Selecionar todas (${filtered.length})`}
          </button>
          <span className="text-sm font-medium">
            {selectedIds.size} selecionada{selectedIds.size === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(e) => handleBulkStatus(e.target.value)}
              disabled={selectedIds.size === 0 || bulkPending}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
            >
              <option value="">Mudar status…</option>
              {SONG_STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkFav(true)}
              disabled={selectedIds.size === 0 || bulkPending}
            >
              <Star className="size-4" />
              Favoritar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkFav(false)}
              disabled={selectedIds.size === 0 || bulkPending}
            >
              Desfavoritar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={selectedIds.size === 0 || bulkPending}
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apagar {selectedIds.size} música
              {selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              render={<Button variant="destructive" disabled={bulkPending} />}
              onClick={handleBulkDelete}
            >
              {bulkPending ? "Apagando…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="Nenhuma música encontrada"
          description="Tente outro filtro ou termo de busca."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {filtered.map((s) => {
              const total = members.length;
              const isExpanded = expanded.has(s.id);
              const mOpen = mobileOpen.has(s.id);

              return (
                <li key={s.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-accent/30",
                      selectMode &&
                        selectedIds.has(s.id) &&
                        "bg-primary/10 hover:bg-primary/15"
                    )}
                  >
                    {selectMode && admin && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        className="size-4 shrink-0 accent-primary"
                        aria-label={`Selecionar ${s.titulo}`}
                      />
                    )}
                    {admin ? (
                      <button
                        onClick={() => handleToggleFav(s.id, s.favorita)}
                        className={cn(
                          "shrink-0 transition-colors",
                          s.favorita
                            ? "text-amber-400"
                            : "text-muted-foreground hover:text-amber-400"
                        )}
                        title={s.favorita ? "Remover dos favoritos" : "Marcar favorita"}
                      >
                        <Star className={cn("size-4", s.favorita && "fill-current")} />
                      </button>
                    ) : (
                      <Star
                        className={cn(
                          "size-4 shrink-0",
                          s.favorita
                            ? "text-amber-400 fill-current"
                            : "text-muted-foreground/30"
                        )}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.titulo}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {s.artista}
                        {s.observacoes && (
                          <span className="text-xs text-muted-foreground/70">
                            {" • "}
                            {s.observacoes}
                          </span>
                        )}
                      </p>
                    </div>

                    <SongStatusBadge status={s.status} />

                    {/* Desktop: ações inline */}
                    <div className="hidden items-center gap-1 md:flex">
                      {renderActions(s)}
                    </div>

                    {/* Mobile: toca pra expandir o card */}
                    <button
                      type="button"
                      onClick={() => toggleMobileOpen(s.id)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent md:hidden"
                      title={mOpen ? "Recolher" : "Mais ações"}
                      aria-expanded={mOpen}
                      aria-label="Mais ações"
                    >
                      <ChevronDown
                        className={cn(
                          "size-5 transition-transform",
                          mOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </div>

                  {/* Mobile: ações expandidas (accordion) */}
                  {mOpen && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/10 px-4 py-2.5 md:hidden">
                      {renderActions(s)}
                    </div>
                  )}

                  {playingId === s.id && s.spotifyTrackId && (
                    <div className="border-t border-border bg-muted/20 px-4 pb-3">
                      <iframe
                        src={`https://open.spotify.com/embed/track/${s.spotifyTrackId}?utm_source=generator`}
                        width="100%"
                        height={152}
                        loading="lazy"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        style={{ border: 0 }}
                        className="mt-3 rounded-xl"
                        title={`Spotify: ${s.titulo}`}
                      />
                    </div>
                  )}

                  {isExpanded && total > 0 && (
                    <div className="px-4 py-2 bg-muted/30 border-t border-border">
                      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                        {members.map((m) => {
                          const r = memberReadiness(s.id, m.id);
                          return (
                            <li
                              key={m.id}
                              className="flex items-center gap-2 py-0.5"
                              title={READINESS_LABEL[r]}
                            >
                              <span
                                className={cn(
                                  "size-2 rounded-full shrink-0",
                                  READINESS_DOT[r]
                                )}
                              />
                              <span className="truncate">{m.nome}</span>
                              <span className="text-muted-foreground text-[10px] ml-auto">
                                {READINESS_LABEL[r]}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {admin && (
                        <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                          Pra mudar, abre a música no lápis (✎) à direita.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
