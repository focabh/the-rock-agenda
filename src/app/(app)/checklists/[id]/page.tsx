import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { checklistTemplates, checklistTemplateItems } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { TemplateForm } from "@/components/checklists/template-form";
import { updateTemplateAction } from "../actions";

export default async function EditarTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template] = await db
    .select()
    .from(checklistTemplates)
    .where(eq(checklistTemplates.id, id))
    .limit(1);
  if (!template) notFound();
  const items = await db
    .select()
    .from(checklistTemplateItems)
    .where(eq(checklistTemplateItems.templateId, id))
    .orderBy(asc(checklistTemplateItems.ordem));

  const action = updateTemplateAction.bind(null, id);

  return (
    <div>
      <PageHeader title={template.nome} description="Editar template" />
      <div className="p-6 max-w-3xl">
        <TemplateForm
          template={template}
          items={items}
          action={action}
          submitLabel="Salvar alterações"
        />
      </div>
    </div>
  );
}
