import { and, asc, gte, lte, or, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  shows,
  members,
  memberUnavailability,
  rehearsals,
} from "@/db/schema";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MonthGrid } from "@/components/agenda/month-grid";
import { MonthNav } from "@/components/agenda/month-nav";
import { CalendarSubscribe } from "@/components/agenda/calendar-subscribe";
import { Card, CardContent } from "@/components/ui/card";
import { colorForMember, brDateKey } from "@/lib/conflicts";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getOrCreateCalendarToken } from "@/lib/calendar";

function parseMonth(m?: string): { year: number; month: number } {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y, month: mo - 1 };
  }
  // Mês atual no fuso de Brasília (o servidor roda em UTC).
  const [y, mo] = brDateKey(new Date()).split("-").map(Number);
  return { year: y, month: mo - 1 };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.m);

  // Janela alargada ±1 dia: cobre a diferença UTC↔Brasília nas bordas do mês.
  // A grade só renderiza células do mês, então shows vizinhos não aparecem.
  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  end.setDate(end.getDate() + 1);

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
  const calendarToken = admin ? await getOrCreateCalendarToken() : null;

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Shows e indisponibilidades dos membros."
        actions={<MonthNav year={year} month={month} />}
      />

      <div className="p-6 space-y-4">
        {admin && calendarToken && (
          <Card>
            <CardContent className="py-4">
              <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="size-4" /> Sincronizar com sua agenda
              </p>
              <CalendarSubscribe token={calendarToken} />
            </CardContent>
          </Card>
        )}

        <MonthGrid
          year={year}
          month={month}
          shows={monthShows}
          blocks={monthBlocks}
          members={allMembers}
          memberColorIndex={Object.fromEntries(
            allMembers.map((m, i) => [m.id, i])
          )}
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
              {allMembers.map((m, i) => {
                const c = colorForMember(m.id, i);
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
