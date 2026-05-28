import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import { NewGastoForm } from "@/components/gastos/new-gasto-form";

export default async function NewGastoPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/gastos");

  const showsWithCasa = await db.query.shows.findMany({
    columns: { id: true, data: true },
    with: { casa: { columns: { nome: true } } },
    orderBy: (s, { desc }) => [desc(s.data)],
  });

  const showOptions = showsWithCasa.map((s) => ({
    id: s.id,
    label: `${s.casa.nome} — ${formatDataBR(s.data)}`,
  }));

  return (
    <div>
      <PageHeader
        title="Novo gasto"
        description="Registre um gasto da banda (equipamento, divulgação, etc.) e anexe o comprovante."
        actions={
          <Button variant="outline" size="sm" render={<Link href="/gastos" />}>
            <ChevronLeft className="size-4" /> Voltar
          </Button>
        }
      />
      <div className="p-6 max-w-2xl">
        <NewGastoForm shows={showOptions} />
      </div>
    </div>
  );
}
