import { PageHeader } from "@/components/shared/page-header";
import { SongForm } from "@/components/repertorio/song-form";
import { createSongAction } from "../actions";

export default function NovaSongPage() {
  return (
    <div>
      <PageHeader title="Nova música" description="Adicionar ao repertório." />
      <div className="p-6 max-w-3xl">
        <SongForm action={createSongAction} submitLabel="Adicionar" />
      </div>
    </div>
  );
}
