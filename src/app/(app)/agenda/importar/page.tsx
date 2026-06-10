import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { IcsImporter } from "@/components/agenda/ics-importer";
import { requireCurrentUser, isAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";

export default async function ImportarAgendaPage() {
  const user = await requireCurrentUser();
  if (!isAdmin(user)) notFound();

  return (
    <div>
      <PageHeader
        title="Importar agenda"
        description="Traga shows e ensaios de outra agenda (.ics do Google, Apple, Outlook)."
        actions={
          <Button render={<Link href="/agenda" />} variant="outline" size="sm">
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        }
      />
      <div className="p-6 max-w-2xl">
        <IcsImporter />
      </div>
    </div>
  );
}
