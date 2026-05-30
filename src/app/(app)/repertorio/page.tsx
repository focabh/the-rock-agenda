import { SongList } from "@/components/repertorio/song-list";
import { SyncLyricsButton } from "@/components/repertorio/sync-lyrics-button";
import { EnrichSongsButton } from "@/components/repertorio/enrich-songs-button";
import { SpotifyConnect } from "@/components/repertorio/spotify-connect";
import { PageHeader } from "@/components/shared/page-header";
import { SpotifyImportDialog } from "@/components/shared/spotify-import-dialog";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { members, songMemberReadiness, songs } from "@/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { BAND } from "@/lib/band";
import { isSpotifyConnected } from "@/lib/spotify";
import { asc, desc, eq } from "drizzle-orm";
import { Download, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";

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
            <SyncLyricsButton />
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
                <EnrichSongsButton />
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
          userPosicao={user?.posicao ?? user?.member?.funcao ?? null}
          members={playableMembers}
          readinessBySong={Object.fromEntries(
            [...readinessBySong.entries()].map(([k, v]) => [
              k,
              Object.fromEntries(v),
            ]),
          )}
        />
      </div>
    </div>
  );
}
