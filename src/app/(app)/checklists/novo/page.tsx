import { PageHeader } from "@/components/shared/page-header";
import { TemplateForm } from "@/components/checklists/template-form";
import { createTemplateAction } from "../actions";

export default function NovoTemplatePage() {
  return (
    <div>
      <PageHeader title="Novo template" description="Lista reutilizável de tarefas." />
      <div className="p-6 max-w-3xl">
        <TemplateForm action={createTemplateAction} submitLabel="Criar template" />
      </div>
    </div>
  );
}
