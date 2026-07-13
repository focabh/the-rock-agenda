import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus, CalendarClock, History } from "lucide-react";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RehearsalRow } from "@/components/agenda/rehearsal-row";
import { getCurrentUser, isSuperuser } from "@/lib/auth";

export default async function EnsaiosPage() {
  const user = await getCurrentUser();
  const admin = isSuperuser(user);
  const lista = await db.select().from(rehearsals).orderBy(asc(rehearsals.data));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const proximos = lista.filter((r) => new Date(r.data) >= startOfToday);
  const passadosCount = lista.length - proximos.length;

  return (
    <div>
      <PageHeader
        title="Ensaios"
        description="Próximos ensaios da banda."
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
            {proximos.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nenhum ensaio agendado"
                description="Os ensaios futuros aparecem aqui. Os anteriores ficam no histórico."
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
                  {proximos.map((r) => (
                    <RehearsalRow key={r.id} r={r} admin={admin} />
                  ))}
                </ul>
              </Card>
            )}

            {/* Acesso SECUNDÁRIO e discreto ao histórico — os ensaios passados não
                ocupam espaço na tela principal, mas nada é apagado (os setlists
                deles seguem salvos e reutilizáveis). */}
            {passadosCount > 0 && (
              <Link
                href="/ensaios/anteriores"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <History className="size-4" />
                Ver ensaios anteriores ({passadosCount})
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
