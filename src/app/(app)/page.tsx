import Link from "next/link";
import { asc, gte, sql, eq, and, ne } from "drizzle-orm";
import {
  CalendarDays,
  CalendarClock,
  Music2,
  Plus,
  ChevronRight,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  Building2,
  ClipboardCheck,
  MapPin,
} from "lucide-react";
import { db } from "@/db";
import {
  shows,
  songs,
  members,
  songMemberReadiness,
  rehearsals,
} from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShowStatusBadge } from "@/components/shared/status-badge";
import { EnsaioStatusBadge } from "@/components/agenda/ensaio-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  formatBRL,
  formatDataBR,
  formatDataExtensa,
  dataPartesBR,
} from "@/lib/formatters";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const now = new Date();

  const proximos = await db.query.shows.findMany({
    where: gte(shows.data, now),
    with: { casa: true },
    orderBy: (s, { asc }) => [asc(s.data)],
    limit: 4,
  });

  const proximosEnsaios = await db
    .select()
    .from(rehearsals)
    .where(gte(rehearsals.data, now))
    .orderBy(asc(rehearsals.data))
    .limit(4);

  const planejadosNaoConfirmados = await db
    .select({ count: sql<number>`count(*)` })
    .from(shows)
    .where(and(gte(shows.data, now), eq(shows.status, "planejado")));

  const pagamentosPendentes = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${shows.cacheCentavos}), 0)`,
    })
    .from(shows)
    .where(
      and(
        eq(shows.status, "concluido"),
        ne(shows.pagamentoStatus, "pago")
      )
    );

  // Repertório pronto = músicas onde TODOS os músicos não-manager ativos estão prontos
  // (ignora aposentada/ideia_futura). Default 'aprendendo' se sem registro.
  const allSongs = await db.select().from(songs);
  const playableSongs = allSongs.filter(
    (s) => s.status !== "aposentada" && s.status !== "ideia_futura"
  );
  const playableMembers = await db.query.members.findMany({
    where: (m, { and, eq }) => and(eq(m.ativo, true)),
  });
  const playableMembersFiltered = playableMembers.filter((m) => !m.isManager);
  const readinessRows = await db.select().from(songMemberReadiness);
  const readinessBySong = new Map<string, Map<string, string>>();
  for (const r of readinessRows) {
    if (!readinessBySong.has(r.songId))
      readinessBySong.set(r.songId, new Map());
    readinessBySong.get(r.songId)!.set(r.memberId, r.status);
  }
  const totalSongs = playableSongs.length;
  const prontas = playableSongs.filter((s) =>
    playableMembersFiltered.every(
      (m) =>
        (readinessBySong.get(s.id)?.get(m.id) ?? "aprendendo") === "pronta"
    )
  ).length;

  const proximoShow = proximos[0];

  return (
    <div>
      <PageHeader
        title="Painel"
        description={`Hoje é ${formatDataExtensa(now)}`}
        actions={
          admin && (
            <Button render={<Link href="/shows/novo" />}>
              <Plus className="size-4" />
              Novo show
            </Button>
          )
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={CalendarDays}
            label="Próximos shows"
            value={proximos.length.toString()}
            hint={
              proximoShow
                ? `Próximo em ${formatDataBR(proximoShow.data)}`
                : "Sem shows agendados"
            }
          />
          <StatCard
            icon={AlertCircle}
            label="A confirmar"
            value={String(Number(planejadosNaoConfirmados[0]?.count ?? 0))}
            hint="Shows planejados não confirmados"
            tone={
              Number(planejadosNaoConfirmados[0]?.count ?? 0) > 0
                ? "amber"
                : "default"
            }
          />
          <StatCard
            icon={Clock}
            label="Cachê a receber"
            value={formatBRL(Number(pagamentosPendentes[0]?.total ?? 0))}
            hint={`${Number(pagamentosPendentes[0]?.count ?? 0)} show(s) concluídos sem pagamento`}
            tone={
              Number(pagamentosPendentes[0]?.count ?? 0) > 0 ? "amber" : "default"
            }
          />
          <StatCard
            icon={TrendingUp}
            label="Repertório pronto"
            value={`${prontas} / ${totalSongs}`}
            hint={
              totalSongs > 0
                ? `${Math.round((prontas / totalSongs) * 100)}% todos prontos`
                : "Sem músicas"
            }
          />
        </div>

        {/* Próximos shows */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Próximos shows
            </h2>
            <Link
              href="/shows"
              className="text-sm text-primary hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          {proximos.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nenhum show agendado"
              description={admin ? "Que tal cadastrar o próximo?" : "Sem shows futuros no momento."}
              action={
                admin && (
                  <Button render={<Link href="/shows/novo" />}>
                    <Plus className="size-4" /> Novo show
                  </Button>
                )
              }
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-border">
                {proximos.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/shows/${s.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30"
                    >
                      <div className="flex flex-col items-center text-center w-14 shrink-0">
                        <span className="text-[10px] uppercase text-muted-foreground tracking-widest">
                          {dataPartesBR(s.data).mes}
                        </span>
                        <span className="text-2xl font-bold leading-none">
                          {dataPartesBR(s.data).dia}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.casa.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDataBR(s.data, true)}
                          {s.inicio && ` • Início ${s.inicio}`}
                        </p>
                      </div>
                      <ShowStatusBadge status={s.status} />
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* Próximos ensaios */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Próximos ensaios
            </h2>
            <Link href="/ensaios" className="text-sm text-primary hover:underline">
              Ver todos →
            </Link>
          </div>
          {proximosEnsaios.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum ensaio agendado"
              description={
                admin ? "Marque o próximo ensaio da banda." : "Sem ensaios futuros no momento."
              }
              action={
                admin && (
                  <Button render={<Link href="/ensaios/novo" />}>
                    <Plus className="size-4" /> Novo ensaio
                  </Button>
                )
              }
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-border">
                {proximosEnsaios.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/ensaios/${r.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30"
                    >
                      <div className="flex flex-col items-center text-center w-14 shrink-0">
                        <span className="text-[10px] uppercase text-muted-foreground tracking-widest">
                          {dataPartesBR(r.data).mes}
                        </span>
                        <span className="text-2xl font-bold leading-none">
                          {dataPartesBR(r.data).dia}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {r.foco || "Ensaio"}
                          {r.inicio && (
                            <span className="font-mono text-muted-foreground ml-2 text-sm">
                              {r.inicio}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                          {(r.local || r.endereco) && (
                            <MapPin className="size-3.5 shrink-0" />
                          )}
                          {[r.local, r.endereco].filter(Boolean).join(" · ") ||
                            formatDataBR(r.data)}
                        </p>
                      </div>
                      <EnsaioStatusBadge status={r.status} />
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* Atalhos */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Acesso rápido
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink href="/repertorio" icon={Music2} title="Repertório" />
            <QuickLink href="/casas" icon={Building2} title="Casas" />
            <QuickLink href="/banda" icon={Users} title="Banda" />
            <QuickLink href="/checklists" icon={ClipboardCheck} title="Checklists" />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "amber";
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p
              className={
                tone === "amber"
                  ? "text-2xl font-bold mt-1 text-amber-400"
                  : "text-2xl font-bold mt-1"
              }
            >
              {value}
            </p>
            {hint && (
              <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            )}
          </div>
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
            <Icon className="size-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/40 hover:bg-accent/40">
        <CardContent className="py-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20">
            <Icon className="size-5 text-primary" />
          </div>
          <span className="font-medium">{title}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
