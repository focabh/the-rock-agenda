import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { Plus, ExternalLink, Download } from "lucide-react";
import { db } from "@/db";
import { songs, members, songMemberReadiness } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SongList } from "@/components/repertorio/song-list";
import { BAND } from "@/lib/band";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { SpotifyImportDialog } from "@/components/shared/spotify-import-dialog";
import { SpotifyConnect } from "@/components/repertorio/spotify-connect";
import { isSpotifyConnected } from "@/lib/spotify";

export default async function RepertorioPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const spotify = admin
    ? await isSpotifyConnected()
    : { connected: false, ownerName: null };
  const lista = await db
    .select()
    .from(songs)
    .orderBy(desc(songs.favorita), asc(songs.titulo));

  // Músicos ativos não-manager
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.ativo, true))
    .orderBy(asc(members.nome));
  const playableMembers = allMembers.filter((m) => !m.isManager);

  const readinessRows = await db.select().from(songMemberReadiness);
  const readinessBySong = new Map<string, Map<string, string>>();
  for (const r of readinessRows) {
    if (!readinessBySong.has(r.songId)) {
      readinessBySong.set(r.songId, new Map());
    }
    readinessBySong.get(r.songId)!.set(r.memberId, r.status);
  }

  return (
    <div>
      <PageHeader
        title="Repertório"
        description="Tudo que a banda toca, está aprendendo ou pode tocar."
        actions={
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              variant="outline"
              render={
                <a
                  href={BAND.spotifyPlaylistUrl}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink className="size-4" />
              Playlist Spotify
            </Button>
            {admin && (
              <>
                <SpotifyConnect
                  connected={spotify.connected}
                  ownerName={spotify.ownerName ?? null}
                />
                <SpotifyImportDialog
                  mode="repertorio"
                  trigger={
                    <Button variant="outline">
                      <Download className="size-4" />
                      Importar
                    </Button>
                  }
                />
                <Button render={<Link href="/repertorio/novo" />}>
                  <Plus className="size-4" /> Nova música
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="p-6">
        <SongList
          songs={lista}
          admin={admin}
          members={playableMembers}
          readinessBySong={Object.fromEntries(
            [...readinessBySong.entries()].map(([k, v]) => [
              k,
              Object.fromEntries(v),
            ])
          )}
        />
      </div>
    </div>
  );
}
