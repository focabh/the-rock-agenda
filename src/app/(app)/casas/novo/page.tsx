import { PageHeader } from "@/components/shared/page-header";
import { CasaForm } from "@/components/casas/casa-form";
import { createCasaAction } from "../actions";

export default function NovaCasaPage() {
  return (
    <div>
      <PageHeader
        title="Nova casa"
        description="Cadastrar bar, pub ou casa de show."
      />
      <div className="p-6 max-w-3xl">
        <CasaForm action={createCasaAction} submitLabel="Criar casa" />
      </div>
    </div>
  );
}
