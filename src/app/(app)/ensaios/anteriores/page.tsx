import Link from "next/link";
import { desc } from "drizzle-orm";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { RehearsalRow } from "@/components/agenda/rehearsal-row";
import { getCurrentUser, isSuperuser } from "@/lib/auth";

/** Histórico de ensaios — tela PRÓPRIA. Os ensaios passados ficam aqui (não na
 *  tela principal), com tudo preservado: os setlists/repertório de cada um
 *  continuam salvos e reutilizáveis. Nada é excluído automaticamente. */
export default async function EnsaiosAnterioresPage() {
  const user = await getCurrentUser();
  const admin = isSuperuser(user);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Ordena por data desc no banco e filtra os passados (mais recente primeiro).
  const passados = (await db.select().from(rehearsals).orderBy(desc(rehearsals.data))).filter(
    (r) => new Date(r.data) < startOfToday
  );

  return (
    <div>
      <PageHeader
        title="Ensaios anteriores"
        description="Histórico da banda. Os setlists de cada ensaio seguem salvos e reutilizáveis."
        actions={
          <Link
            href="/ensaios"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar aos ensaios
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {passados.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nenhum ensaio anterior"
            description="Quando um ensaio passar, ele fica guardado aqui."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {passados.map((r) => (
                <RehearsalRow key={r.id} r={r} admin={admin} />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
