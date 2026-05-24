import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { shows, venues } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { ShowForm } from "@/components/shows/show-form";
import { updateShowAction } from "../../actions";
import { formatDataBR } from "@/lib/formatters";

export default async function EditarShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [show] = await db.select().from(shows).where(eq(shows.id, id)).limit(1);
  if (!show) notFound();
  const casas = await db.select().from(venues).orderBy(asc(venues.nome));

  const action = updateShowAction.bind(null, id);

  return (
    <div>
      <PageHeader
        title="Editar show"
        description={formatDataBR(show.data, true)}
      />
      <div className="p-6 max-w-3xl">
        <ShowForm
          show={show}
          casas={casas}
          action={action}
          submitLabel="Salvar alterações"
          cancelHref={`/shows/${id}`}
        />
      </div>
    </div>
  );
}
