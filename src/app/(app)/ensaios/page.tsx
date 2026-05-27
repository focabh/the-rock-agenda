import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus, CalendarClock, ChevronRight, Pencil, MapPin } from "lucide-react";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/shared/delete-button";
import { EnsaioStatusBadge } from "@/components/agenda/ensaio-status-badge";
import { deleteRehearsalAction } from "@/app/(app)/agenda/actions";
import { formatDataBR, dataPartesBR } from "@/lib/formatters";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import type { Rehearsal } from "@/db/schema";

function Row({ r, admin }: { r: Rehearsal; admin: boolean }) {
  const partes = dataPartesBR(r.data);
  return (
    <li className="flex items-center gap-2 pr-3">
      <Link
        href={`/ensaios/${r.id}`}
        className="flex items-center gap-4 flex-1 min-w-0 px-5 py-4 hover:bg-accent/30"
      >
        <div className="flex flex-col items-center text-center w-16 shrink-0">
          <span className="text-[10px] uppercase text-muted-foreground tracking-widest">
            {partes.mes}
          </span>
          <span className="text-2xl font-bold leading-none">{partes.dia}</span>
          <span className="text-xs text-muted-foreground mt-1">
            {partes.ano}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {r.foco || "Ensaio"}
            {r.inicio && (
              <span className="font-mono text-muted-foreground ml-2 text-sm">
                {r.inicio}
                {r.termino ? `–${r.termino}` : ""}
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
            {(r.local || r.endereco) && <MapPin className="size-3.5 shrink-0" />}
            {[r.local, r.endereco].filter(Boolean).join(" · ") ||
              formatDataBR(r.data)}
          </p>
        </div>
        <EnsaioStatusBadge status={r.status} />
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </Link>
      {admin && (
        <>
          <Button
            render={<Link href={`/ensaios/${r.id}/editar`} />}
            variant="ghost"
            size="icon"
            title="Editar"
          >
            <Pencil className="size-4" />
          </Button>
          <DeleteButton
            action={deleteRehearsalAction.bind(null, r.id)}
            itemName="Ensaio"
          />
        </>
      )}
    </li>
  );
}

export default async function EnsaiosPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const lista = await db
    .select()
    .from(rehearsals)
    .orderBy(asc(rehearsals.data));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const proximos = lista.filter((r) => new Date(r.data) >= startOfToday);
  const passados = lista
    .filter((r) => new Date(r.data) < startOfToday)
    .reverse();

  return (
    <div>
      <PageHeader
        title="Ensaios"
        description="Próximos ensaios e histórico da banda."
        actions={
          admin && (
            <Button render={<Link href="/ensaios/novo" />}>
              <Plus className="size-4" /> Novo ensaio
            </Button>
          )
        }
      />

      <div className="p-6 space-y-6">
        {lista.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nenhum ensaio cadastrado"
            description="Crie o próximo ensaio da banda — ele também aparece na Agenda."
            action={
              admin && (
                <Button render={<Link href="/ensaios/novo" />}>
                  <Plus className="size-4" /> Novo ensaio
                </Button>
              )
            }
          />
        ) : (
          <>
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Próximos
              </h2>
              {proximos.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">
                  Nenhum ensaio agendado.
                </p>
              ) : (
                <Card className="overflow-hidden p-0">
                  <ul className="divide-y divide-border">
                    {proximos.map((r) => (
                      <Row key={r.id} r={r} admin={admin} />
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            {passados.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Anteriores
                </h2>
                <Card className="overflow-hidden p-0">
                  <ul className="divide-y divide-border">
                    {passados.map((r) => (
                      <Row key={r.id} r={r} admin={admin} />
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
