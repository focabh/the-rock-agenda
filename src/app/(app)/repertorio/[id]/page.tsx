import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { songs, members, songMemberReadiness } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { SongForm } from "@/components/repertorio/song-form";
import { ReadinessSection } from "@/components/repertorio/readiness-section";
import { LyricsPanel } from "@/components/repertorio/lyrics-panel";
import { VocalCuesEditor } from "@/components/repertorio/vocal-cues-editor";
import { SongTomEditor } from "@/components/repertorio/song-tom-editor";
import { SongPresetEditor } from "@/components/repertorio/song-preset-editor";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { updateSongAction } from "../actions";

export default async function EditarSongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();

  const [allMembers, currentUser] = await Promise.all([
    db
      .select()
      .from(members)
      .where(eq(members.ativo, true))
      .orderBy(asc(members.nome)),
    getCurrentUser(),
  ]);
  const playableMembers = allMembers.filter((m) => !m.isManager);
  const admin = isAdmin(currentUser);

  const readiness = await db
    .select()
    .from(songMemberReadiness)
    .where(eq(songMemberReadiness.songId, id));

  const action = updateSongAction.bind(null, id);

  return (
    <div>
      <PageHeader title={song.titulo} description={song.artista} />
      <div className="p-6 max-w-3xl space-y-6">
        {admin && (
          <SongForm
            song={song}
            action={action}
            submitLabel="Salvar alterações"
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <SongTomEditor songId={id} initial={song.tom} />
          <SongPresetEditor songId={id} initial={song.vozPreset} />
        </div>

        <ReadinessSection
          songId={id}
          members={playableMembers}
          isAdmin={admin}
          currentMemberId={currentUser?.member?.id ?? null}
          initial={readiness.map((r) => ({
            memberId: r.memberId,
            status: r.status,
          }))}
        />

        <VocalCuesEditor
          songId={id}
          lyrics={song.lyrics}
          initialCue={song.vozCueInicial}
          vocalCuesRaw={song.vocalCues}
        />

        <LyricsPanel
          songId={id}
          titulo={song.titulo}
          spotifyTrackId={song.spotifyTrackId}
          admin={admin}
        />
      </div>
    </div>
  );
}
