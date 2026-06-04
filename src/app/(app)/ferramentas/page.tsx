import { asc } from "drizzle-orm";
import { db } from "@/db";
import { songs } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { FerramentasClient, type SongTempo } from "@/components/ferramentas/ferramentas-client";

export default async function FerramentasPage() {
  const rows = await db
    .select({ id: songs.id, titulo: songs.titulo, artista: songs.artista, tom: songs.tom, bpm: songs.bpm, observacoes: songs.observacoes })
    .from(songs)
    .orderBy(asc(songs.titulo));
  const lista: SongTempo[] = rows.map((s) => ({
    id: s.id,
    titulo: s.titulo,
    artista: s.artista,
    tom: s.tom,
    bpm: s.bpm,
    obs: s.observacoes,
  }));

  return (
    <div>
      <PageHeader
        title="Afinador & Metrônomo"
        description="Ferramentas de ensaio — afine pelo microfone e marque o tempo. Funciona offline, no seu aparelho."
      />
      <FerramentasClient songs={lista} />
      <p className="px-6 pb-6 text-center text-[11px] text-muted-foreground/70">
        Dados de BPM por{" "}
        <a href="https://getsongbpm.com" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
          GetSongBPM
        </a>
        .
      </p>
    </div>
  );
}
