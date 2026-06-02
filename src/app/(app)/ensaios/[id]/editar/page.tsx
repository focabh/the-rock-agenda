import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { rehearsals, shows } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { RehearsalPageForm } from "@/components/agenda/rehearsal-page-form";
import { formatDataBR } from "@/lib/formatters";
import { requireSuperuser } from "@/lib/auth";

export default async function EditarEnsaioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperuser();
  const { id } = await params;
  const [r] = await db.select().from(rehearsals).where(eq(rehearsals.id, id)).limit(1);
  if (!r) notFound();

  const showRows = await db.query.shows.findMany({ with: { casa: { columns: { nome: true } } }, orderBy: [asc(shows.data)] });
  const showOpts = showRows.map((s) => ({ id: s.id, label: `${s.casa.nome} · ${formatDataBR(s.data)}` }));

  return (
    <div>
      <PageHeader title="Editar ensaio" description="Atualize os dados do ensaio." />
      <div className="p-6 max-w-2xl">
        <RehearsalPageForm rehearsal={r} redirectTo={`/ensaios/${r.id}`} shows={showOpts} />
      </div>
    </div>
  );
}
