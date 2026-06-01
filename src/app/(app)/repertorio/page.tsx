import { SongList } from "@/components/repertorio/song-list";
import { SyncLyricsButton } from "@/components/repertorio/sync-lyrics-button";
import { EnrichSongsButton } from "@/components/repertorio/enrich-songs-button";
import { SpotifyPopularityButton } from "@/components/repertorio/spotify-popularity-button";
import { SpotifyConnect } from "@/components/repertorio/spotify-connect";
import { PageHeader } from "@/components/shared/page-header";
import { SpotifyImportDialog } from "@/components/shared/spotify-import-dialog";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { members, songMemberReadiness, songs } from "@/db/schema";
import { adminMaterialPorPosicao, getBrand, getCurrentUser, isAdmin } from "@/lib/auth";
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
  // Por padrão o admin sempre vê letras; se ligou a preferência, segue a posição.
  const matPorPosicao = admin ? await adminMaterialPorPosicao() : false;
  const brand = admin ? await getBrand() : null;
  // Nudge: músicas sem metadados deixam o gerador de setlist "cego".
  const semMeta = lista.filter(
    (s) => s.status !== "aposentada" && s.energia == null
  ).length;

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
                  defaultUrl={brand?.spotifyListRepertorio}
                  trigger={
                    <Button variant="outline">
                      <Download className="size-4" />
                      Importar
                    </Button>
                  }
                />
                <EnrichSongsButton />
                <SpotifyPopularityButton />
                <Button render={<Link href="/repertorio/novo" />}>
                  <Plus className="size-4" /> Nova música
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {admin && semMeta > 0 && (
          <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {semMeta} música(s) sem detalhes
            </span>{" "}
            (energia/momento) — o gerador de setlist fica cego nelas. Preencha na
            mão (lápis) ou use{" "}
            <span className="font-medium text-foreground">“Detalhes com IA”</span>{" "}
            acima.
          </div>
        )}
        <SongList
          songs={lista}
          admin={admin}
          adminMaterialPorPosicao={matPorPosicao}
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
