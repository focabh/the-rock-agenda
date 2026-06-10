import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FinancialImporter } from "@/components/gastos/financial-importer";
import { requireCurrentUser, isAdmin } from "@/lib/auth";

export default async function ImportarGastosPage() {
  const user = await requireCurrentUser();
  if (!isAdmin(user)) notFound();

  return (
    <div>
      <PageHeader
        title="Importar financeiro"
        description="Traga o histórico de gastos de uma planilha — a IA organiza as colunas."
        actions={
          <Button render={<Link href="/gastos" />} variant="outline" size="sm">
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        }
      />
      <div className="p-6 max-w-3xl">
        <FinancialImporter />
      </div>
    </div>
  );
}
