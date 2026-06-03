import { eq, inArray } from "drizzle-orm";
import { Music2, Building2, Star, CalendarDays, Trophy, Mic2 } from "lucide-react";
import { db } from "@/db";
import { shows, rehearsals, songs, members, showMemberPresence } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export default async function EstatisticasPage() {
  await getCurrentUser(); // transparência: todos veem

  const [concluidos, totalShows, totalEnsaios, totalSongs, allMembers] = await Promise.all([
    db.query.shows.findMany({
      where: eq(shows.status, "concluido"),
      with: {
        casa: { columns: { nome: true } },
        setlists: { columns: { oficial: true }, with: { items: { columns: { songId: true } } } },
      },
    }),
    db.$count(shows),
    db.$count(rehearsals),
    db.$count(songs),
    db.select().from(members),
  ]);

  const memberById = new Map(allMembers.map((m) => [m.id, m.nome]));
  const concluidoIds = concluidos.map((s) => s.id);

  // Música mais tocada = em quantos shows concluídos ela entrou (setlist oficial,
  // ou qualquer setlist se não houver oficial). Distinto por show.
  const songCount = new Map<string, number>();
  for (const s of concluidos) {
    const oficial = s.setlists.find((sl) => sl.oficial) ?? s.setlists[0];
    if (!oficial) continue;
    const ids = new Set(oficial.items.map((i) => i.songId));
    for (const id of ids) songCount.set(id, (songCount.get(id) ?? 0) + 1);
  }
  const songTitulo = new Map((await db.select({ id: songs.id, titulo: songs.titulo }).from(songs)).map((s) => [s.id, s.titulo]));
  const topSongs = [...songCount.entries()]
    .map(([id, n]) => ({ titulo: songTitulo.get(id) ?? "—", n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  // Casa onde mais tocamos (nº de shows concluídos).
  const casaCount = new Map<string, number>();
  for (const s of concluidos) casaCount.set(s.casa.nome, (casaCount.get(s.casa.nome) ?? 0) + 1);
  const topCasas = [...casaCount.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n).slice(0, 6);

  // Presença: quem mais confirmou presença em shows concluídos.
  const presRows = concluidoIds.length
    ? await db.select().from(showMemberPresence).where(inArray(showMemberPresence.showId, concluidoIds))
    : [];
  const presCount = new Map<string, number>();
  for (const p of presRows) if (p.status === "confirmado") presCount.set(p.memberId, (presCount.get(p.memberId) ?? 0) + 1);
  const topPresenca = allMembers
    .filter((m) => !m.isManager)
    .map((m) => ({ nome: m.nome, n: presCount.get(m.id) ?? 0 }))
    .sort((a, b) => b.n - a.n);

  const vazio = totalShows === 0 && totalSongs === 0;

  return (
    <div>
      <PageHeader title="Estatísticas" description="Os números da banda — o que mais toca, onde mais toca e quem mais aparece." />
      <div className="p-6 space-y-6">
        {vazio ? (
          <Card>
            <EmptyState icon={Trophy} title="Sem dados ainda" description="Conforme rolarem shows e ensaios, os números aparecem aqui." />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi icon={<CalendarDays className="size-4" />} label="Shows feitos" value={concluidos.length} />
              <Kpi icon={<CalendarDays className="size-4" />} label="Shows (total)" value={totalShows} />
              <Kpi icon={<Mic2 className="size-4" />} label="Ensaios" value={totalEnsaios} />
              <Kpi icon={<Music2 className="size-4" />} label="Músicas no repertório" value={totalSongs} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Rank titulo="Músicas mais tocadas" icon={<Music2 className="size-4" />} itens={topSongs.map((s) => ({ nome: s.titulo, n: s.n, sufixo: "show(s)" }))} vazio="Marque o setlist dos shows concluídos." />
              <Rank titulo="Casas onde mais tocamos" icon={<Building2 className="size-4" />} itens={topCasas.map((c) => ({ nome: c.nome, n: c.n, sufixo: "show(s)" }))} vazio="—" />
              <Rank titulo="Presença (quem mais aparece)" icon={<Star className="size-4" />} itens={topPresenca.map((p) => ({ nome: p.nome, n: p.n, sufixo: "show(s)" }))} vazio="Sem presenças confirmadas." />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{icon} {label}</p>
        <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Rank({ titulo, icon, itens, vazio }: { titulo: string; icon: React.ReactNode; itens: { nome: string; n: number; sufixo: string }[]; vazio: string }) {
  const max = Math.max(1, ...itens.map((i) => i.n));
  return (
    <Card>
      <CardContent className="py-5">
        <p className="mb-4 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">{icon} {titulo}</p>
        {itens.length === 0 || itens.every((i) => i.n === 0) ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <ul className="space-y-2.5">
            {itens.filter((i) => i.n > 0).map((it, idx) => (
              <li key={idx} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{it.nome}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">{it.n} {it.sufixo}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${(it.n / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
