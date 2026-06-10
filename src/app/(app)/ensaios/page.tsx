import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus, CalendarClock, Pencil, MapPin } from "lucide-react";
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
import { getCurrentUser, isSuperuser } from "@/lib/auth";
import type { Rehearsal } from "@/db/schema";

function Row({ r, admin }: { r: Rehearsal; admin: boolean }) {
  const partes = dataPartesBR(r.data);
  return (
    <li className="flex items-center gap-2 pr-3">
      <Link
        href={`/ensaios/${r.id}`}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 hover:bg-accent/30"
      >
        <div className="flex flex-col items-center text-center w-12 shrink-0">
          <span className="text-[10px] uppercase text-muted-foreground tracking-widest">
            {partes.mes}
          </span>
          <span className="text-2xl font-bold leading-none">{partes.dia}</span>
          <span className="text-xs text-muted-foreground mt-0.5">{partes.ano}</span>
        </div>
        {/* Conteúdo em 2 níveis pra caber no mobile sem cortar: foco (até 2
            linhas) + status; embaixo horário e local com largura total. */}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium leading-snug line-clamp-3">
            {r.foco || "Ensaio"}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <EnsaioStatusBadge status={r.status} />
            {r.inicio && (
              <span className="font-mono">
                {r.inicio}
                {r.termino ? `–${r.termino}` : ""}
              </span>
            )}
            {(r.local || r.endereco) && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{r.local || r.endereco}</span>
              </span>
            )}
            {!r.inicio && !r.local && !r.endereco && (
              <span>{formatDataBR(r.data)}</span>
            )}
          </div>
        </div>
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
  const admin = isSuperuser(user);
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
