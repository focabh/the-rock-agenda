import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus, Building2, MapPin, Phone, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteButton } from "@/components/shared/delete-button";
import { deleteCasaAction } from "./actions";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function CasasPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const lista = await db.select().from(venues).orderBy(asc(venues.nome));

  return (
    <div>
      <PageHeader
        title="Casas"
        description="Lugares onde a banda toca ou já tocou."
        actions={
          admin && (
            <Button render={<Link href="/casas/novo" />}>
              <Plus className="size-4" /> Nova casa
            </Button>
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {lista.map((c) => (
              <Card
                key={c.id}
                className="flex flex-col overflow-hidden p-0 transition-colors hover:border-primary/40"
              >
                <Link href={`/casas/${c.id}`} className="block flex-1 hover:bg-accent/30">
                  <CardContent className="py-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{c.nome}</h3>
                        {(c.bairro || c.cidade) && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3.5" />
                            {[c.bairro, c.cidade].filter(Boolean).join(" • ")}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </div>

                    {c.contatoPrincipal && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Contato:</span>{" "}
                        {c.contatoPrincipal}
                      </p>
                    )}

                    {c.telefone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="size-3.5" />
                        {c.telefone}
                      </p>
                    )}

                    {c.observacoes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {c.observacoes}
                      </p>
                    )}
                  </CardContent>
                </Link>
                {admin && (
                  <div className="flex items-center justify-end border-t border-border px-3 py-2">
                    <DeleteButton
                      itemName={c.nome}
                      action={deleteCasaAction.bind(null, c.id)}
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
