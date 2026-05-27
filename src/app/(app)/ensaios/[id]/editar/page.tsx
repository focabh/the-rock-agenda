import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { RehearsalPageForm } from "@/components/agenda/rehearsal-page-form";
import { requireAdmin } from "@/lib/auth";

export default async function EditarEnsaioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [r] = await db.select().from(rehearsals).where(eq(rehearsals.id, id)).limit(1);
  if (!r) notFound();

  return (
    <div>
      <PageHeader title="Editar ensaio" description="Atualize os dados do ensaio." />
      <div className="p-6 max-w-2xl">
        <RehearsalPageForm rehearsal={r} redirectTo={`/ensaios/${r.id}`} />
      </div>
    </div>
  );
}
