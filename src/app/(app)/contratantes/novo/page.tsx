import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth";
import { NewContractorLinkForm } from "@/components/contratantes/new-link-form";

export default async function NewContractorLinkPage() {
  await requireCurrentUser();
  return (
    <div>
      <PageHeader
        title="Novo link de divulgação"
        description="Gere um link pra um contratante ver o material da banda. Padrão 10 dias, pode estender ou revogar depois."
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/contratantes" />}
          >
            <ChevronLeft className="size-4" /> Voltar
          </Button>
        }
      />
      <div className="p-6 max-w-xl">
        <NewContractorLinkForm />
      </div>
    </div>
  );
}
