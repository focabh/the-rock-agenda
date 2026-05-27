import { and, asc, gte, lte, or, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  shows,
  members,
  memberUnavailability,
  rehearsals,
} from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { MonthGrid } from "@/components/agenda/month-grid";
import { MonthNav } from "@/components/agenda/month-nav";
import { Card, CardContent } from "@/components/ui/card";
import { colorForMember } from "@/lib/conflicts";
import { getCurrentUser, isAdmin } from "@/lib/auth";

function parseMonth(m?: string): { year: number; month: number } {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y, month: mo - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.m);

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [monthShows, monthBlocks, allMembers, monthRehearsals, currentUser] =
    await Promise.all([
      db.query.shows.findMany({
        where: and(gte(shows.data, start), lte(shows.data, end)),
        with: { casa: true },
        orderBy: (s, { asc }) => [asc(s.data)],
      }),
      db.query.memberUnavailability.findMany({
        where: or(
          and(
            gte(memberUnavailability.dataInicio, start),
            lte(memberUnavailability.dataInicio, end)
          ),
          and(
            gte(memberUnavailability.dataFim, start),
            lte(memberUnavailability.dataFim, end)
          ),
          and(
            lte(memberUnavailability.dataInicio, start),
            gte(memberUnavailability.dataFim, end)
          )
        ),
      }),
      db
        .select()
        .from(members)
        .where(eq(members.ativo, true))
        .orderBy(asc(members.nome)),
      db
        .select()
        .from(rehearsals)
        .where(and(gte(rehearsals.data, start), lte(rehearsals.data, end)))
        .orderBy(asc(rehearsals.data)),
      getCurrentUser(),
    ]);

  const admin = isAdmin(currentUser);

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Shows e indisponibilidades dos membros."
        actions={<MonthNav year={year} month={month} />}
      />

      <div className="p-6 space-y-4">
        <MonthGrid
          year={year}
          month={month}
          shows={monthShows}
          blocks={monthBlocks}
          members={allMembers}
          rehearsals={monthRehearsals}
          isAdmin={admin}
          currentMemberId={currentUser?.member?.id ?? null}
        />

        {/* Legenda dos membros */}
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Legenda
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-block w-4 h-4 rounded bg-primary/30 ring-1 ring-primary/50" />
                Show
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-block w-4 h-4 rounded bg-emerald-500/30 ring-1 ring-emerald-500/50" />
                Ensaio
              </div>
              {allMembers.map((m) => {
                const c = colorForMember(m.id);
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="inline-block w-4 h-4 rounded ring-1"
                      style={{ backgroundColor: c.bg, borderColor: c.ring }}
                    />
                    {m.nome}
                  </div>
                );
              })}
              <div className="flex items-center gap-2 text-sm ml-4">
                <span className="text-amber-400">⚠</span>
                Conflito (show + membro indisponível)
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Clique em um dia do calendário para{" "}
              {admin
                ? "marcar ensaio, show ou indisponibilidade"
                : "marcar sua indisponibilidade ou confirmar presença"}
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
