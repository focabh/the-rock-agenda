"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, Heart, ThumbsDown, Music2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setSongFeedbackAction } from "@/app/(app)/shows/[id]/actions-feedback";

type Flags = { publicoCurtiu: boolean; bandaCurtiu: boolean; caiu: boolean };
type Row = { songId: string; titulo: string; artista: string };

const CHIPS: { key: keyof Flags; label: string; icon: typeof ThumbsUp; on: string }[] = [
  { key: "publicoCurtiu", label: "Público curtiu", icon: ThumbsUp, on: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40" },
  { key: "bandaCurtiu", label: "Curtimos tocar", icon: Heart, on: "bg-red-500/15 text-red-300 ring-red-500/40" },
  { key: "caiu", label: "Caiu / morno", icon: ThumbsDown, on: "bg-zinc-500/20 text-zinc-300 ring-zinc-400/40" },
];

export function SongFeedbackList({
  showId,
  songs,
  initial,
}: {
  showId: string;
  songs: Row[];
  initial: Record<string, Flags>;
}) {
  const [state, setState] = useState<Record<string, Flags>>(initial);
  const [, start] = useTransition();

  function toggle(songId: string, key: keyof Flags) {
    setState((prev) => {
      const cur = prev[songId] ?? { publicoCurtiu: false, bandaCurtiu: false, caiu: false };
      const next = { ...cur, [key]: !cur[key] };
      // "Caiu" e "Público curtiu" são opostos — marcar um desmarca o outro.
      if (key === "caiu" && next.caiu) next.publicoCurtiu = false;
      if (key === "publicoCurtiu" && next.publicoCurtiu) next.caiu = false;
      const updated = { ...prev, [songId]: next };
      start(async () => {
        const r = await setSongFeedbackAction(showId, songId, next);
        if (!r.ok) toast.error("Não salvou.");
      });
      return updated;
    });
  }

  if (songs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Music2 className="mx-auto mb-2 size-6" />
          Monte o setlist do show pra avaliar música por música.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-5">
        <h3 className="mb-1 font-semibold">Como foi cada música?</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Marcação da banda (qualquer um pode editar). Isso alimenta as sugestões
          em casas de perfil parecido.
        </p>
        <ul className="divide-y divide-border">
          {songs.map((s) => {
            const f = state[s.songId] ?? { publicoCurtiu: false, bandaCurtiu: false, caiu: false };
            return (
              <li key={s.songId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.titulo}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.artista}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CHIPS.map((c) => {
                    const Icon = c.icon;
                    const active = f[c.key];
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => toggle(s.songId, c.key)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                          active ? c.on : "text-muted-foreground ring-border hover:bg-accent/50"
                        )}
                      >
                        <Icon className="size-3.5" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
