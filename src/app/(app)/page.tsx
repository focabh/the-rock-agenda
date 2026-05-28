import Link from "next/link";
import { asc, gte, eq, and, ne, gt, inArray } from "drizzle-orm";
import {
  CalendarDays,
  CalendarClock,
  Music2,
  Plus,
  ChevronRight,
  Users,
  Building2,
  MapPin,
  UserPlus,
  Wallet,
  Receipt,
  Megaphone,
  Coins,
} from "lucide-react";
import { db } from "@/db";
import {
  shows,
  rehearsals,
  users,
  members,
  showMemberPresence,
  showMemberPayment,
  showMemberPaid,
} from "@/db/schema";
import { computePaymentBreakdown } from "@/lib/payment";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
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

const TOP = 3; // mostra os 3 primeiros e "Ver todos (N)"

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const now = new Date();

  // Carrega tudo em paralelo (sem cache curto pra evitar dado velho no painel).
  const [proximosShows, proximosEnsaios, cacheReceber, pendentes] =
    await Promise.all([
      db.query.shows.findMany({
        where: gte(shows.data, now),
        with: { casa: true },
        orderBy: (s, { asc }) => [asc(s.data)],
      }),
      db
        .select()
        .from(rehearsals)
        .where(gte(rehearsals.data, now))
        .orderBy(asc(rehearsals.data)),
      db.query.shows.findMany({
        where: and(
          eq(shows.status, "concluido"),
          ne(shows.pagamentoStatus, "pago")
        ),
        with: { casa: true },
        orderBy: (s, { asc }) => [asc(s.data)],
      }),
      admin
        ? db
            .select({
              id: users.id,
              nome: users.nome,
              sobrenome: users.sobrenome,
              username: users.username,
              posicao: users.posicao,
            })
            .from(users)
            .where(eq(users.status, "pendente"))
            .orderBy(asc(users.createdAt))
        : Promise.resolve([] as Array<{
            id: string;
            nome: string | null;
            sobrenome: string | null;
            username: string;
            posicao: string | null;
          }>),
    ]);

  const totalDasCasas = cacheReceber.reduce(
    (s, r) => s + (r.cacheCentavos ?? 0),
    0
  );

  // Cachê da banda → músicos: agregado por show (count + total a pagar).
  // Mostrado só pro admin (gestão do repasse).
  type BandaPagar = {
    showId: string;
    casaNome: string;
    showData: Date;
    count: number;
    total: number;
  };
  let bandaPraMusicos: BandaPagar[] = [];
  let totalDaBanda = 0;
  if (admin) {
    const payableShows = await db.query.shows.findMany({
      where: and(
        gt(shows.cacheCentavos, 0),
        inArray(shows.status, ["confirmado", "concluido"])
      ),
      with: { casa: true },
      orderBy: (s, { desc }) => [desc(s.data)],
    });
    const showIds = payableShows.map((s) => s.id);
    const [allMembers, presences, overrides, paidRows] = await Promise.all([
      db.select().from(members),
      showIds.length
        ? db
            .select()
            .from(showMemberPresence)
            .where(inArray(showMemberPresence.showId, showIds))
        : Promise.resolve([] as (typeof showMemberPresence.$inferSelect)[]),
      showIds.length
        ? db
            .select()
            .from(showMemberPayment)
            .where(inArray(showMemberPayment.showId, showIds))
        : Promise.resolve([] as (typeof showMemberPayment.$inferSelect)[]),
      showIds.length
        ? db
            .select()
            .from(showMemberPaid)
            .where(inArray(showMemberPaid.showId, showIds))
        : Promise.resolve([] as (typeof showMemberPaid.$inferSelect)[]),
    ]);
    const managerMember = allMembers.find((m) => m.isManager) ?? null;
    const playable = allMembers.filter((m) => !m.isManager && m.ativo);
    const confirmedByShow = new Map<string, Set<string>>();
    for (const p of presences) {
      if (p.status !== "confirmado") continue;
      if (!confirmedByShow.has(p.showId))
        confirmedByShow.set(p.showId, new Set());
      confirmedByShow.get(p.showId)!.add(p.memberId);
    }
    const overridesByShow = new Map<string, Map<string, number>>();
    for (const o of overrides) {
      if (!overridesByShow.has(o.showId))
        overridesByShow.set(o.showId, new Map());
      overridesByShow.get(o.showId)!.set(o.memberId, o.valorCentavos);
    }
    const paidSet = new Set(
      paidRows.map((r) => `${r.showId}-${r.memberId}`)
    );
    for (const s of payableShows) {
      const confirmedIds = confirmedByShow.get(s.id) ?? new Set<string>();
      const confirmedMusicos = playable.filter((m) => confirmedIds.has(m.id));
      if (confirmedMusicos.length === 0) continue;
      const breakdown = computePaymentBreakdown({
        cacheCentavos: s.cacheCentavos ?? 0,
        applyCommission: s.applyCommission,
        commissionPct: s.commissionPct,
        confirmedMusicos,
        managerMember,
        overrides: overridesByShow.get(s.id) ?? new Map(),
      });
      let count = 0;
      let total = 0;
      for (const m of confirmedMusicos) {
        if (paidSet.has(`${s.id}-${m.id}`)) continue;
        const info = breakdown.perMember.get(m.id);
        if (!info) continue;
        count++;
        total += info.valorCentavos;
      }
      if (count > 0) {
        bandaPraMusicos.push({
          showId: s.id,
          casaNome: s.casa.nome,
          showData: s.data,
          count,
          total,
        });
      }
    }
    totalDaBanda = bandaPraMusicos.reduce((s, x) => s + x.total, 0);
  }

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
        {/* Aprovações pendentes (admin) */}
        {admin && pendentes.length > 0 && (
          <Section
            title="Aprovações pendentes"
            count={pendentes.length}
            href="/cadastros"
            tone="amber"
          >
            <ul className="divide-y divide-border">
              {pendentes.slice(0, TOP).map((u) => {
                const nome =
                  [u.nome, u.sobrenome].filter(Boolean).join(" ") || u.username;
                return (
                  <li key={u.id}>
                    <Link
                      href="/cadastros"
                      className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30"
                    >
                      <div className="flex size-10 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/30 shrink-0">
                        <UserPlus className="size-4 text-amber-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.posicao || "Posição a definir"} ·{" "}
                          <span className="font-mono">@{u.username}</span>
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* Próximos shows */}
        <Section
          title="Próximos shows"
          count={proximosShows.length}
          href="/shows"
        >
          {proximosShows.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nenhum show agendado"
              description={
                admin
                  ? "Que tal cadastrar o próximo?"
                  : "Sem shows futuros no momento."
              }
              action={
                admin && (
                  <Button render={<Link href="/shows/novo" />}>
                    <Plus className="size-4" /> Novo show
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {proximosShows.slice(0, TOP).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/shows/${s.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30"
                  >
                    <DateBlock data={s.data} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.casa.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDataBR(s.data, true)}
                        {s.termino && ` até ${s.termino}`}
                      </p>
                    </div>
                    <ShowStatusBadge status={s.status} />
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Próximos ensaios */}
        <Section
          title="Próximos ensaios"
          count={proximosEnsaios.length}
          href="/ensaios"
        >
          {proximosEnsaios.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum ensaio agendado"
              description={
                admin
                  ? "Marque o próximo ensaio da banda."
                  : "Sem ensaios futuros no momento."
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
            <ul className="divide-y divide-border">
              {proximosEnsaios.slice(0, TOP).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/ensaios/${r.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30"
                  >
                    <DateBlock data={r.data} />
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
          )}
        </Section>

        {/* Cachês a serem pagos (admin) */}
        {admin &&
          (cacheReceber.length > 0 || bandaPraMusicos.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-medium uppercase tracking-wider text-amber-300">
                  Cachês a serem pagos
                </h2>
                <span className="font-mono text-sm text-amber-300">
                  {formatBRL(totalDasCasas + totalDaBanda)}
                </span>
              </div>

              {/* Das casas → banda */}
              {cacheReceber.length > 0 && (
                <SubGroup
                  label="Das casas → banda"
                  count={cacheReceber.length}
                  total={totalDasCasas}
                >
                  <ul className="divide-y divide-border">
                    {cacheReceber.slice(0, TOP).map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/shows/${s.id}`}
                          className="flex items-center gap-4 px-5 py-3 hover:bg-accent/30"
                        >
                          <div className="flex size-9 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/30 shrink-0">
                            <Coins className="size-4 text-amber-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {s.casa.nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDataBR(s.data)} · status{" "}
                              {s.pagamentoStatus}
                            </p>
                          </div>
                          <span className="font-mono text-sm">
                            {formatBRL(s.cacheCentavos ?? 0)}
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </SubGroup>
              )}

              {/* Da banda → músicos (agregado por show) */}
              {bandaPraMusicos.length > 0 && (
                <SubGroup
                  label="Da banda → músicos"
                  count={bandaPraMusicos.length}
                  total={totalDaBanda}
                >
                  <ul className="divide-y divide-border">
                    {bandaPraMusicos.slice(0, TOP).map((b) => (
                      <li key={b.showId}>
                        <Link
                          href={`/pagamentos`}
                          className="flex items-center gap-4 px-5 py-3 hover:bg-accent/30"
                        >
                          <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
                            <Music2 className="size-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {b.casaNome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDataBR(b.showData)} · {b.count} músico
                              {b.count === 1 ? "" : "s"} a pagar
                            </p>
                          </div>
                          <span className="font-mono text-sm">
                            {formatBRL(b.total)}
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </SubGroup>
              )}
            </section>
          )}

        {/* Acesso rápido */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Acesso rápido
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink href="/repertorio" icon={Music2} title="Repertório" />
            <QuickLink href="/casas" icon={Building2} title="Casas" />
            <QuickLink href="/banda" icon={Users} title="Banda" />
            <QuickLink href="/pagamentos" icon={Wallet} title="Cachês" />
            {admin && (
              <QuickLink href="/gastos" icon={Receipt} title="Gastos" />
            )}
            <QuickLink href="/divulgacao" icon={Megaphone} title="Material" />
          </div>
        </section>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  href,
  tone = "default",
  extra,
  children,
}: {
  title: string;
  count: number;
  href: string;
  tone?: "default" | "amber";
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          className={
            tone === "amber"
              ? "text-sm font-medium uppercase tracking-wider text-amber-300"
              : "text-sm font-medium uppercase tracking-wider text-muted-foreground"
          }
        >
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {extra}
          <Link href={href} className="text-sm text-primary hover:underline">
            Ver todos ({count}) →
          </Link>
        </div>
      </div>
      <Card className="overflow-hidden p-0">{children}</Card>
    </section>
  );
}

function SubGroup({
  label,
  count,
  total,
  children,
}: {
  label: string;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-muted-foreground">
            {formatBRL(total)}
          </span>
          <Link
            href="/pagamentos"
            className="text-primary hover:underline"
          >
            Ver todos ({count}) →
          </Link>
        </div>
      </div>
      <Card className="overflow-hidden p-0">{children}</Card>
    </div>
  );
}

function DateBlock({ data }: { data: Date | number }) {
  const p = dataPartesBR(data);
  return (
    <div className="flex flex-col items-center text-center w-14 shrink-0">
      <span className="text-[10px] uppercase text-muted-foreground tracking-widest">
        {p.mes}
      </span>
      <span className="text-2xl font-bold leading-none">{p.dia}</span>
    </div>
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
        <div className="py-4 px-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20">
            <Icon className="size-5 text-primary" />
          </div>
          <span className="font-medium">{title}</span>
        </div>
      </Card>
    </Link>
  );
}
