import Link from "next/link";
import { and, asc, eq, isNotNull, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, MapPin, Clock, Target, StickyNote } from "lucide-react";
import { db } from "@/db";
import { rehearsals, members, rehearsalMemberPresence, setlists, songs, shows } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EnsaioStatusBadge } from "@/components/agenda/ensaio-status-badge";
import { PresenceCard } from "@/components/shows/presence-card";
import { SetlistTab } from "@/components/shows/setlist-tab";
import { NotifyBandButton } from "@/components/shared/notify-band-button";
import { setRehearsalPresenceAction } from "@/app/(app)/agenda/actions";
import { formatDataExtensa, formatDataBR } from "@/lib/formatters";
import { getCurrentUser, isAdmin, getBrand } from "@/lib/auth";

function mapsUrl(r: {
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
}) {
  if (r.latitude != null && r.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`;
  }
  if (r.endereco) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.endereco)}`;
  }
  return null;
}

export default async function EnsaioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [r] = await db.select().from(rehearsals).where(eq(rehearsals.id, id)).limit(1);
  if (!r) notFound();

  const [user, playableMembers, presences, ensaioSetlists, allSongs] = await Promise.all([
    getCurrentUser(),
    db
      .select()
      .from(members)
      .where(and(eq(members.ativo, true), eq(members.isManager, false)))
      .orderBy(asc(members.nome)),
    db
      .select()
      .from(rehearsalMemberPresence)
      .where(eq(rehearsalMemberPresence.rehearsalId, id)),
    db.query.setlists.findMany({
      where: eq(setlists.rehearsalId, id),
      with: { items: { with: { song: true } } },
    }),
    db.select().from(songs).orderBy(asc(songs.titulo)),
  ]);
  const admin = isAdmin(user);
  const brand = await getBrand();
  // Ensaio/repertório → grupo dos músicos (se existir); senão, o grupo geral.
  const grupoEnsaio = brand.whatsappGrupoMusicos || brand.whatsappGrupo;

  // Show vinculado (opcional) → permite importar o setlist dele pro ensaio.
  let importarDoShow: { showId: string; label: string } | null = null;
  if (r.showId) {
    const linked = await db.query.shows.findFirst({
      where: eq(shows.id, r.showId),
      with: { casa: { columns: { nome: true } } },
    });
    if (linked) importarDoShow = { showId: linked.id, label: `${linked.casa.nome} · ${formatDataBR(linked.data)}` };
  }

  // "Simular show": shows que têm setlist com músicas, ordenados pela
  // proximidade da data do ensaio (o mais próximo vem pré-selecionado).
  let simular: { shows: { id: string; label: string }[]; defaultShowId: string } | null = null;
  if (admin) {
    const setRows = await db.query.setlists.findMany({
      where: isNotNull(setlists.showId),
      columns: { showId: true },
      with: { items: { columns: { id: true } } },
    });
    const showIdsComSet = [
      ...new Set(setRows.filter((s) => s.items.length > 0).map((s) => s.showId!)),
    ];
    if (showIdsComSet.length > 0) {
      const showRows = await db.query.shows.findMany({
        where: inArray(shows.id, showIdsComSet),
        with: { casa: { columns: { nome: true } } },
      });
      const rData = r.data.getTime();
      const ordenados = showRows
        .map((s) => ({
          id: s.id,
          label: `${s.casa.nome} · ${formatDataBR(s.data)}`,
          dist: Math.abs(s.data.getTime() - rData),
        }))
        .sort((a, b) => a.dist - b.dist);
      simular = {
        shows: ordenados.map(({ id, label }) => ({ id, label })),
        defaultShowId: ordenados[0].id,
      };
    }
  }

  const maps = mapsUrl(r);
  const quando = `dia ${formatDataBR(r.data)}${
    r.inicio ? ` às ${r.inicio}` : ""
  }`;

  const Item = ({
    icon: Icon,
    label,
    children,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-start gap-3">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Ensaio"
        description={formatDataExtensa(r.data)}
        actions={
          <div className="flex items-center gap-2">
            <Button render={<Link href="/ensaios" />} variant="outline" size="sm">
              <ArrowLeft className="size-4" /> Voltar
            </Button>
            {admin && (
              <NotifyBandButton
                title="Ensaio da banda"
                body={`${quando}${r.local ? ` • ${r.local}` : ""} — confirme presença!`}
                url={`/ensaios/${r.id}`}
                tag={`ensaio-${r.id}`}
              />
            )}
            {admin && (
              <Button render={<Link href={`/ensaios/${r.id}/editar`} />} size="sm">
                <Pencil className="size-4" /> Editar
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 max-w-2xl space-y-6">
        <Card>
          <CardContent className="py-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold capitalize">
                {formatDataExtensa(r.data)}
              </span>
              <EnsaioStatusBadge status={r.status} />
            </div>

            {(r.inicio || r.termino) && (
              <Item icon={Clock} label="Horário">
                {r.inicio}
                {r.termino ? ` às ${r.termino}` : ""}
              </Item>
            )}

            {(r.local || r.endereco) && (
              <Item icon={MapPin} label="Local">
                {r.local && <p>{r.local}</p>}
                {r.endereco && <p className="text-muted-foreground">{r.endereco}</p>}
                {maps && (
                  <a
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs"
                  >
                    Ver no mapa →
                  </a>
                )}
              </Item>
            )}

            {r.foco && (
              <Item icon={Target} label="Foco do ensaio">
                {r.foco}
              </Item>
            )}

            {r.observacoes && (
              <Item icon={StickyNote} label="Observações">
                <p className="whitespace-pre-wrap">{r.observacoes}</p>
              </Item>
            )}
          </CardContent>
        </Card>

        <PresenceCard
          eventId={r.id}
          action={setRehearsalPresenceAction}
          members={playableMembers}
          presences={presences}
          currentMemberId={user?.member?.id ?? null}
          admin={admin}
          wa={{
            label: "ensaio",
            quando,
            local: r.local || r.endereco || "",
            path: `/ensaios/${r.id}`,
          }}
          groupLink={grupoEnsaio}
        />
      </div>

      <div className="px-6 pb-10">
        <h2 className="mb-3 text-lg font-semibold">Setlist do ensaio</h2>
        <SetlistTab
          rehearsalId={r.id}
          setlists={ensaioSetlists}
          allSongs={allSongs}
          canEdit={admin}
          userPosicao={user?.posicao ?? user?.member?.funcao ?? null}
          ensaioInfo={{ dataLabel: formatDataBR(r.data), foco: r.foco }}
          groupLink={grupoEnsaio}
          importarDoShow={importarDoShow}
          simular={simular}
          spotifyDefaultUrl={brand.spotifyListEnsaio}
        />
      </div>
    </div>
  );
}
