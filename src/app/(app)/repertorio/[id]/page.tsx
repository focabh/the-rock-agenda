import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { songs, members, songMemberReadiness } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { SongForm } from "@/components/repertorio/song-form";
import { ReadinessSection } from "@/components/repertorio/readiness-section";
import { updateSongAction } from "../actions";

export default async function EditarSongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();

  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.ativo, true))
    .orderBy(asc(members.nome));
  const playableMembers = allMembers.filter((m) => !m.isManager);

  const readiness = await db
    .select()
    .from(songMemberReadiness)
    .where(eq(songMemberReadiness.songId, id));

  const action = updateSongAction.bind(null, id);

  return (
    <div>
      <PageHeader title={song.titulo} description={song.artista} />
      <div className="p-6 max-w-3xl space-y-6">
        <SongForm song={song} action={action} submitLabel="Salvar alterações" />
        <ReadinessSection
          songId={id}
          members={playableMembers}
          initial={readiness.map((r) => ({
            memberId: r.memberId,
            status: r.status,
          }))}
        />
      </div>
    </div>
  );
}
