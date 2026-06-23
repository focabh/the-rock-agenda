import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { songs, members, songMemberReadiness, appSettings } from "@/db/schema";
import { getPedalModel, DEFAULT_PEDAL_MODEL } from "@/lib/voz-pedais";
import { parseVozPedal } from "@/lib/voz-pedal";
import { PageHeader } from "@/components/shared/page-header";
import { SongForm } from "@/components/repertorio/song-form";
import { ReadinessSection } from "@/components/repertorio/readiness-section";
import { LyricsPanel } from "@/components/repertorio/lyrics-panel";
import { VozPedalEditor } from "@/components/repertorio/voz-pedal-editor";
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

  const [settings] = await db.select({ m: appSettings.vozPedalModelo }).from(appSettings).limit(1);
  const pedalModel = getPedalModel(settings?.m ?? DEFAULT_PEDAL_MODEL);
  const presetAtual = parseVozPedal(song.vozPedal)?.preset ?? null;

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

        <VozPedalEditor
          songId={id}
          modeloNome={pedalModel?.nome ?? ""}
          presets={pedalModel?.presets ?? []}
          initialPresetId={presetAtual}
        />

        <LyricsPanel
          songId={id}
          spotifyTrackId={song.spotifyTrackId}
          admin={admin}
        />
      </div>
    </div>
  );
}
