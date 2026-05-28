import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ChevronLeft, Plus, Share2 } from "lucide-react";
import { db } from "@/db";
import { contractorLinks, users } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { requireAdmin } from "@/lib/auth";
import { ContratantesList } from "@/components/contratantes/contratantes-list";

export default async function ContratantesPage() {
  await requireAdmin();

  // Pega links + nome de quem criou (pra mostrar na lista).
  const links = await db
    .select({
      id: contractorLinks.id,
      token: contractorLinks.token,
      label: contractorLinks.label,
      expiresEm: contractorLinks.expiresEm,
      revokedEm: contractorLinks.revokedEm,
      viewCount: contractorLinks.viewCount,
      lastViewedEm: contractorLinks.lastViewedEm,
      createdAt: contractorLinks.createdAt,
      creatorApelido: users.apelido,
      creatorNome: users.nome,
      creatorUsername: users.username,
    })
    .from(contractorLinks)
    .leftJoin(users, eq(contractorLinks.createdBy, users.id))
    .orderBy(desc(contractorLinks.createdAt));

  return (
    <div>
      <PageHeader
        title="Contratantes"
        description="Crie links com expiração pra mostrar press kit e vídeos da banda pra quem te chamou. Sem cadastro, sem fricção."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" render={<Link href="/" />}>
              <ChevronLeft className="size-4" /> Painel
            </Button>
            <Button size="sm" render={<Link href="/contratantes/novo" />}>
              <Plus className="size-4" /> Novo link
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {links.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="Nenhum link ainda"
            description="Crie o primeiro pra mandar pra um contratante. Validade padrão de 10 dias, com opção de estender ou revogar a qualquer hora."
            action={
              <Button render={<Link href="/contratantes/novo" />}>
                <Plus className="size-4" /> Novo link
              </Button>
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <ContratantesList
              links={links.map((l) => ({
                id: l.id,
                token: l.token,
                label: l.label,
                expiresEmISO: l.expiresEm.toISOString(),
                revokedEmISO: l.revokedEm?.toISOString() ?? null,
                viewCount: l.viewCount,
                lastViewedEmISO: l.lastViewedEm?.toISOString() ?? null,
                createdAtISO: l.createdAt.toISOString(),
                creator:
                  l.creatorApelido ||
                  l.creatorNome ||
                  l.creatorUsername ||
                  "—",
              }))}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
