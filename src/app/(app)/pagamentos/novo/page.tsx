import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import { NewPaymentForm } from "@/components/pagamentos/new-payment-form";

export default async function NewPaymentPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/pagamentos");

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
        title="Novo pagamento"
        description="Registre um pagamento e anexe o comprovante PIX."
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/pagamentos" />}
          >
            <ChevronLeft className="size-4" /> Voltar
          </Button>
        }
      />
      <div className="p-6 max-w-2xl">
        <NewPaymentForm shows={showOptions} />
      </div>
    </div>
  );
}
