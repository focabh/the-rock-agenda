import Link from "next/link";
import { asc, lte } from "drizzle-orm";
import { Plus, Building2, Radar } from "lucide-react";
import { db } from "@/db";
import { venues, shows } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CasasBrowser, type CasaItem } from "@/components/casas/casas-browser";
import { CapturarLogosButton } from "@/components/casas/capturar-logos-button";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function CasasPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const lista = await db.select().from(venues).orderBy(asc(venues.nome));

  // Casas com show passado → "Já tocamos" efetivo (mesmo sem o flag manual).
  const pastRows = await db
    .select({ casaId: shows.casaId })
    .from(shows)
    .where(lte(shows.data, new Date()));
  const pastSet = new Set(pastRows.map((r) => r.casaId));

  const casas: CasaItem[] = lista.map((c) => ({
    id: c.id,
    nome: c.nome,
    bairro: c.bairro,
    cidade: c.cidade,
    contatoPrincipal: c.contatoPrincipal,
    telefone: c.telefone,
    observacoes: c.observacoes,
    querTocar: c.querTocar,
    jaTocou: c.jaTocou || pastSet.has(c.id),
    jaTocouManual: c.jaTocou,
    temShowPassado: pastSet.has(c.id),
    voltaria: c.voltaria,
    naoContatar: c.naoContatar,
    ultimoContatoEmISO: c.ultimoContatoEm?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Casas"
        description="Lugares onde a banda toca ou já tocou."
        actions={
          admin && (
            <div className="flex flex-wrap gap-2">
              <CapturarLogosButton />
              <Button render={<Link href="/casas/descobrir" />} variant="outline">
                <Radar className="size-4" /> Descobrir
              </Button>
              <Button render={<Link href="/casas/novo" />}>
                <Plus className="size-4" /> Nova casa
              </Button>
            </div>
          )
        }
      />

      <div className="p-6">
        {lista.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma casa cadastrada"
            description="Comece adicionando os bares e pubs onde vocês tocam."
            action={
              admin && (
                <Button render={<Link href="/casas/novo" />}>
                  <Plus className="size-4" /> Nova casa
                </Button>
              )
            }
          />
        ) : (
          <CasasBrowser casas={casas} admin={admin} />
        )}
      </div>
    </div>
  );
}
