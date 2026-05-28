import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { ChevronLeft, Plus, Share2 } from "lucide-react";
import { db } from "@/db";
import { contractorLinks, contractorLinkVisits, users } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { isAdmin, requireCurrentUser } from "@/lib/auth";
import { ContratantesList } from "@/components/contratantes/contratantes-list";

export default async function ContratantesPage() {
  const me = await requireCurrentUser();
  const admin = isAdmin(me);

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
      createdBy: contractorLinks.createdBy,
      creatorApelido: users.apelido,
      creatorNome: users.nome,
      creatorUsername: users.username,
    })
    .from(contractorLinks)
    .leftJoin(users, eq(contractorLinks.createdBy, users.id))
    .orderBy(desc(contractorLinks.createdAt));

  // Visitas reais (excluindo prévias do criador/admin, já filtradas no log).
  const linkIds = links.map((l) => l.id);
  const visits =
    linkIds.length === 0
      ? []
      : await db
          .select()
          .from(contractorLinkVisits)
          .where(inArray(contractorLinkVisits.linkId, linkIds))
          .orderBy(desc(contractorLinkVisits.visitedAt));

  const statsByLink = new Map<
    string,
    {
      total: number;
      uniqueIps: number;
      lastAt: string | null;
      lastCity: string | null;
    }
  >();
  for (const l of links) statsByLink.set(l.id, {
    total: 0,
    uniqueIps: 0,
    lastAt: null,
    lastCity: null,
  });
  const ipsByLink = new Map<string, Set<string>>();
  for (const v of visits) {
    const s = statsByLink.get(v.linkId);
    if (!s) continue;
    s.total++;
    if (!ipsByLink.has(v.linkId)) ipsByLink.set(v.linkId, new Set());
    if (v.ip) ipsByLink.get(v.linkId)!.add(v.ip);
    // Visits estão em ordem desc; primeiro visto = mais recente.
    if (s.lastAt === null) {
      s.lastAt = v.visitedAt.toISOString();
      s.lastCity = v.city ?? null;
    }
  }
  for (const [id, set] of ipsByLink) {
    const s = statsByLink.get(id);
    if (s) s.uniqueIps = set.size;
  }

  return (
    <div>
      <PageHeader
        title="Divulgação"
        description="Crie links com expiração pra mostrar press kit e vídeos da banda pra possíveis contratantes. Sem cadastro, sem fricção pra eles."
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
              links={links.map((l) => {
                const s = statsByLink.get(l.id);
                return {
                  id: l.id,
                  token: l.token,
                  label: l.label,
                  expiresEmISO: l.expiresEm.toISOString(),
                  revokedEmISO: l.revokedEm?.toISOString() ?? null,
                  visitCount: s?.total ?? 0,
                  uniqueDevices: s?.uniqueIps ?? 0,
                  lastVisitISO: s?.lastAt ?? null,
                  lastVisitCity: s?.lastCity ?? null,
                  createdAtISO: l.createdAt.toISOString(),
                  createdById: l.createdBy ?? null,
                  creator:
                    l.creatorApelido ||
                    l.creatorNome ||
                    l.creatorUsername ||
                    "—",
                };
              })}
              currentUserId={me.id}
              admin={admin}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
