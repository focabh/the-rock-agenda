import { SongList } from "@/components/repertorio/song-list";
import { SyncLyricsButton } from "@/components/repertorio/sync-lyrics-button";
import { EnrichSongsButton } from "@/components/repertorio/enrich-songs-button";
import { SpotifyPopularityButton } from "@/components/repertorio/spotify-popularity-button";
import { BpmFetchButton } from "@/components/repertorio/bpm-fetch-button";
import { AddSongMenu } from "@/components/repertorio/add-song-menu";
import { SpotifyConnect } from "@/components/repertorio/spotify-connect";
import { SpotifyExportButton } from "@/components/repertorio/spotify-export-button";
import { SpotifyDiagnoseButton } from "@/components/repertorio/spotify-diagnose-button";
import { SpotifySyncButton } from "@/components/repertorio/spotify-sync-button";
import { VozPresetsButton } from "@/components/repertorio/voz-presets-button";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { members, songMemberReadiness, songs } from "@/db/schema";
import { adminMaterialPorPosicao, getBrand, getCurrentUser, isAdmin, isSuperuser } from "@/lib/auth";
import { BAND } from "@/lib/band";
import { isSpotifyConnected } from "@/lib/spotify";
import { asc, desc, eq } from "drizzle-orm";
import { ExternalLink, Printer } from "lucide-react";

export default async function RepertorioPage() {
  const user = await getCurrentUser();
  // Repertório é gerenciado por admin (manager) + superusuário. Demais veem leitura.
  const admin = isAdmin(user);
  // Conectar/desconectar o Spotify (credencial do app) é só do superusuário.
  const superuser = isSuperuser(user);
  const spotify = superuser
    ? await isSpotifyConnected()
    : { connected: false, ownerName: null, canExport: false };
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
            <Button
              variant="outline"
              render={
                <a href="/repertorio/imprimir" target="_blank" rel="noreferrer" />
              }
            >
              <Printer className="size-4" />
              Imprimir
            </Button>
            <SyncLyricsButton />
            {admin && (
              <>
                {superuser && (
                  <SpotifyConnect
                    connected={spotify.connected}
                    ownerName={spotify.ownerName ?? null}
                  />
                )}
                {superuser && (
                  <SpotifyExportButton mode="repertorio" label="Copiar pro Spotify" />
                )}
                {superuser && spotify.connected && <SpotifyDiagnoseButton />}
                <SpotifySyncButton hasPlaylist={!!brand?.spotifyListRepertorio} />
                <VozPresetsButton />
                <EnrichSongsButton />
                <SpotifyPopularityButton />
                <BpmFetchButton />
                <AddSongMenu defaultUrl={brand?.spotifyListRepertorio} />
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
