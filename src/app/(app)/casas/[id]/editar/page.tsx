import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { CasaForm } from "@/components/casas/casa-form";
import { requireAdmin } from "@/lib/auth";
import { updateCasaAction } from "../../actions";

export default async function EditarCasaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [casa] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
  if (!casa) notFound();

  const action = updateCasaAction.bind(null, id);

  return (
    <div>
      <PageHeader title={casa.nome} description="Editar casa" />
      <div className="p-6 max-w-3xl">
        <CasaForm casa={casa} action={action} submitLabel="Salvar alterações" />
      </div>
    </div>
  );
}
