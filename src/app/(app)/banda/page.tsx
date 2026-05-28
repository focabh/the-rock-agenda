import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus, Users, Phone, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { members } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteButton } from "@/components/shared/delete-button";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { deleteMemberAction } from "./actions";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function BandaPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const lista = await db.select().from(members).orderBy(asc(members.nome));
  const totalMusicos = lista
    .filter((m) => !m.isManager)
    .reduce((sum, m) => sum + (m.percentualDivisao ?? 0), 0);
  const comissaoManager = lista
    .filter((m) => m.isManager)
    .reduce((sum, m) => sum + (m.percentualDivisao ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Banda"
        description="Membros, contatos, equipamentos e divisão de cachê."
        actions={
          admin && (
            <Button render={<Link href="/banda/novo" />}>
              <Plus className="size-4" /> Novo membro
            </Button>
          )
        }
      />

      <div className="p-6 space-y-4">
        {lista.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Divisão entre músicos:{" "}
            <span
              className={
                totalMusicos === 100
                  ? "text-emerald-400 font-medium"
                  : "text-amber-400 font-medium"
              }
            >
              {totalMusicos.toFixed(1)}%
            </span>
            {totalMusicos !== 100 && (
              <span className="text-amber-400/70"> (ideal: 100%)</span>
            )}
            {comissaoManager > 0 && (
              <span className="ml-2">
                + comissão do manager:{" "}
                <span className="text-amber-300 font-medium">
                  {comissaoManager.toFixed(1)}%
                </span>
              </span>
            )}
          </p>
        )}

        {lista.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum membro cadastrado"
            description="Comece adicionando os músicos da banda."
            action={
              admin && (
                <Button render={<Link href="/banda/novo" />}>
                  <Plus className="size-4" /> Novo membro
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((m) => (
              <Card
                key={m.id}
                className="overflow-hidden p-0 transition-colors hover:border-primary/40"
              >
                <Link
                  href={`/banda/${m.id}`}
                  className="block hover:bg-accent/30"
                >
                  <CardContent className="py-4 px-4 flex items-center gap-3">
                    <MemberAvatar member={m} size={48} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate flex items-center gap-2">
                        {m.nome}
                        {m.isManager && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
                            Manager
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-primary truncate">{m.funcao}</p>
                      {m.telefone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="size-3" />
                          {m.telefone}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {m.percentualDivisao !== null &&
                        m.percentualDivisao > 0 && (
                          <span
                            className="font-mono text-xs text-muted-foreground"
                            title={m.isManager ? "Comissão" : "Divisão do cachê"}
                          >
                            {m.percentualDivisao}%
                          </span>
                        )}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Link>
                {admin && (
                  <div className="flex items-center justify-end border-t border-border px-3 py-1.5">
                    <DeleteButton
                      itemName={m.nome}
                      action={deleteMemberAction.bind(null, m.id)}
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
