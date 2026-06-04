"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Music, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpotifyImportDialog } from "@/components/shared/spotify-import-dialog";

export function AddSongMenu({ defaultUrl }: { defaultUrl?: string | null }) {
  const [spotifyOpen, setSpotifyOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button>
              <Plus className="size-4" />
              Adicionar música
              <ChevronDown className="size-4 opacity-70" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem render={<Link href="/repertorio/novo" />}>
            <Pencil className="size-4" />
            <span className="flex flex-col">
              <span>Manualmente</span>
              <span className="text-xs text-muted-foreground">
                Título, artista, tom…
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSpotifyOpen(true)}>
            <Music className="size-4" />
            <span className="flex flex-col">
              <span>Importar do Spotify</span>
              <span className="text-xs text-muted-foreground">
                Playlist ou lista colada
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SpotifyImportDialog
        mode="repertorio"
        open={spotifyOpen}
        onOpenChange={setSpotifyOpen}
        defaultUrl={defaultUrl}
      />
    </>
  );
}
