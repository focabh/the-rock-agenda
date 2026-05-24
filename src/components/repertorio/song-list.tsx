"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Star, Pencil, Music2, Users, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  SongStatusBadge,
  SONG_STATUS_OPTIONS,
} from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { Song, Member } from "@/db/schema";
import {
  deleteSongAction,
  toggleFavoritaAction,
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
}: {
  songs: Song[];
  admin?: boolean;
  members?: Member[];
  readinessBySong?: ReadinessMap;
}) {
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
  const [, startTransition] = useTransition();

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
              const ready = readyCount(s.id);
              const total = members.length;
              const allReady = total > 0 && ready === total;
              const isExpanded = expanded.has(s.id);

              return (
                <li key={s.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30">
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

                    <SongStatusBadge status={s.status} />

                    {admin && (
                      <div className="flex items-center gap-1">
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
                      </div>
                    )}
                  </div>

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
