import Link from "next/link";
import { desc } from "drizzle-orm";
import { Plus, CalendarDays, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ShowStatusBadge,
  PagamentoStatusBadge,
} from "@/components/shared/status-badge";
import { formatDataBR, formatBRL, dataPartesBR } from "@/lib/formatters";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function ShowsPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  // Próximos primeiro (ASC), depois os passados em ordem inversa
  const lista = await db.query.shows.findMany({
    with: { casa: true },
    orderBy: (s, { asc }) => [asc(s.data)],
  });

  return (
    <div>
      <PageHeader
        title="Shows"
        description="Agenda, status, contatos e financeiro de cada apresentação."
        actions={
          admin && (
            <Button render={<Link href="/shows/novo" />}>
              <Plus className="size-4" /> Novo show
            </Button>
          )
        }
      />

      <div className="p-6">
        {lista.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhum show cadastrado"
            description="Comece adicionando o próximo show da banda."
            action={
              admin && (
                <Button render={<Link href="/shows/novo" />}>
                  <Plus className="size-4" /> Novo show
                </Button>
              )
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {lista.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/shows/${s.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30"
                  >
                    <div className="flex flex-col items-center text-center w-16 shrink-0">
                      <span className="text-[10px] uppercase text-muted-foreground tracking-widest">
                        {dataPartesBR(s.data).mes}
                      </span>
                      <span className="text-2xl font-bold leading-none">
                        {dataPartesBR(s.data).dia}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {dataPartesBR(s.data).ano}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.casa.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDataBR(s.data, true)}
                        {s.inicio && ` • Início ${s.inicio}`}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <ShowStatusBadge status={s.status} />
                      {s.cacheCentavos != null && s.cacheCentavos > 0 && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatBRL(s.cacheCentavos)}
                        </span>
                      )}
                    </div>
                    <div className="hidden md:block">
                      <PagamentoStatusBadge status={s.pagamentoStatus} />
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
