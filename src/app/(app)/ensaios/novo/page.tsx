import { PageHeader } from "@/components/shared/page-header";
import { RehearsalPageForm } from "@/components/agenda/rehearsal-page-form";
import { requireAdmin } from "@/lib/auth";

export default async function NovoEnsaioPage() {
  await requireAdmin();
  return (
    <div>
      <PageHeader title="Novo ensaio" description="Agende um ensaio da banda." />
      <div className="p-6 max-w-2xl">
        <RehearsalPageForm redirectTo="/ensaios" />
      </div>
    </div>
  );
}
