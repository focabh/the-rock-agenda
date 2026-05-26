import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { ShowForm } from "@/components/shows/show-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createShowAction } from "../actions";

export default async function NovoShowPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const defaultDate = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined;
  const casas = await db.select().from(venues).orderBy(asc(venues.nome));

  return (
    <div>
      <PageHeader title="Novo show" description="Agendar uma nova apresentação." />
      <div className="p-6 max-w-3xl">
        {casas.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Cadastre uma casa primeiro"
            description="Você precisa ter ao menos uma casa cadastrada para criar um show."
            action={
              <Button render={<Link href="/casas/novo" />}>Cadastrar casa</Button>
            }
          />
        ) : (
          <ShowForm
            casas={casas}
            action={createShowAction}
            submitLabel="Criar show"
            defaultDate={defaultDate}
          />
        )}
      </div>
    </div>
  );
}
