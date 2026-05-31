import { PageHeader } from "@/components/shared/page-header";
import { MemberForm } from "@/components/banda/member-form";
import { getAvailablePositions } from "@/lib/auth";
import { createMemberAction } from "../actions";

export default async function NovoMembroPage() {
  const positions = await getAvailablePositions();
  return (
    <div>
      <PageHeader title="Novo membro" description="Cadastrar músico da banda." />
      <div className="p-6 max-w-3xl">
        <MemberForm
          action={createMemberAction}
          submitLabel="Criar membro"
          positions={positions}
        />
      </div>
    </div>
  );
}
