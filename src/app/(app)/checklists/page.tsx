import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus, ClipboardCheck, Pencil } from "lucide-react";
import { db } from "@/db";
import { checklistTemplates, checklistTemplateItems } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteButton } from "@/components/shared/delete-button";
import { deleteTemplateAction } from "./actions";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function ChecklistsPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const lista = await db
    .select()
    .from(checklistTemplates)
    .orderBy(asc(checklistTemplates.nome));

  const counts = await db
    .select({ templateId: checklistTemplateItems.templateId })
    .from(checklistTemplateItems);

  const countByTemplate = counts.reduce<Record<string, number>>((acc, r) => {
    acc[r.templateId] = (acc[r.templateId] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Checklists"
        description="Templates reutilizáveis aplicáveis aos shows."
        actions={
          admin && (
            <Button render={<Link href="/checklists/novo" />}>
              <Plus className="size-4" /> Novo template
            </Button>
          )
        }
      />

      <div className="p-6">
        {lista.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhum template criado"
            description="Crie templates para reutilizar nos shows (divulgação, equipamentos, etc.)."
            action={
              admin && (
                <Button render={<Link href="/checklists/novo" />}>
                  <Plus className="size-4" /> Novo template
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {lista.map((t) => (
              <Card key={t.id}>
                <CardContent className="py-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{t.nome}</h3>
                      <p className="text-xs text-muted-foreground">
                        {countByTemplate[t.id] ?? 0}{" "}
                        {(countByTemplate[t.id] ?? 0) === 1 ? "item" : "itens"}
                      </p>
                    </div>
                  </div>
                  {t.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {t.descricao}
                    </p>
                  )}
                </CardContent>
                {admin && (
                  <div className="flex items-center justify-end gap-1 border-t border-border px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      render={<Link href={`/checklists/${t.id}`} />}
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteButton
                      itemName={t.nome}
                      action={deleteTemplateAction.bind(null, t.id)}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
