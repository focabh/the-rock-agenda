import { asc } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { RehearsalPageForm } from "@/components/agenda/rehearsal-page-form";
import { formatDataBR } from "@/lib/formatters";
import { requireSuperuser } from "@/lib/auth";

export default async function NovoEnsaioPage() {
  await requireSuperuser();
  const showRows = await db.query.shows.findMany({ with: { casa: { columns: { nome: true } } }, orderBy: [asc(shows.data)] });
  const showOpts = showRows.map((s) => ({ id: s.id, label: `${s.casa.nome} · ${formatDataBR(s.data)}` }));
  return (
    <div>
      <PageHeader title="Novo ensaio" description="Agende um ensaio da banda." />
      <div className="p-6 max-w-2xl">
        <RehearsalPageForm redirectTo="/ensaios" shows={showOpts} />
      </div>
    </div>
  );
}
