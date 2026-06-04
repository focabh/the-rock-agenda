"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ListMusic, Music, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpotifyImportDialog } from "@/components/shared/spotify-import-dialog";
import { SpotifySongDialog } from "@/components/repertorio/spotify-song-dialog";

export function AddSongMenu({ defaultUrl }: { defaultUrl?: string | null }) {
  const [songOpen, setSongOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  function Linha({
    icon,
    title,
    sub,
  }: {
    icon: React.ReactNode;
    title: string;
    sub: string;
  }) {
    return (
      <>
        {icon}
        <span className="flex flex-col">
          <span>{title}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
        </span>
      </>
    );
  }

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
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuItem render={<Link href="/repertorio/novo" />}>
            <Linha
              icon={<Pencil className="size-4" />}
              title="Manualmente"
              sub="Título, artista, tom…"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSongOpen(true)}>
            <Linha
              icon={<Music className="size-4" />}
              title="Do Spotify (uma música)"
              sub="Cola o link da faixa"
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setBulkOpen(true)}>
            <Linha
              icon={<ListMusic className="size-4" />}
              title="Importar playlist ou lista"
              sub="Várias de uma vez"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SpotifySongDialog open={songOpen} onOpenChange={setSongOpen} />
      <SpotifyImportDialog
        mode="repertorio"
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        defaultUrl={defaultUrl}
      />
    </>
  );
}
