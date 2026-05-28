import Link from "next/link";
import { desc } from "drizzle-orm";
import { Plus, Wallet, ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import { PagamentosList } from "@/components/pagamentos/pagamentos-list";

export default async function PagamentosPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);

  const rows = await db.select().from(payments).orderBy(desc(payments.paidEm));

  // Rótulo amigável dos shows referenciados.
  const showCasas = await db.query.shows.findMany({
    columns: { id: true, data: true },
    with: { casa: { columns: { nome: true } } },
  });
  const showLabel = new Map(
    showCasas.map((s) => [s.id, `${s.casa.nome} — ${formatDataBR(s.data)}`])
  );

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        description="Histórico de pagamentos efetuados pela banda. Comprovante PIX é obrigatório."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" render={<Link href="/" />}>
              <ChevronLeft className="size-4" /> Painel
            </Button>
            {admin && (
              <Button size="sm" render={<Link href="/pagamentos/novo" />}>
                <Plus className="size-4" /> Novo pagamento
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum pagamento registrado"
            description={
              admin
                ? "Registre o primeiro pagamento aqui — anexe o comprovante PIX pra ficar tudo documentado."
                : "Os admins ainda não registraram pagamentos."
            }
            action={
              admin && (
                <Button render={<Link href="/pagamentos/novo" />}>
                  <Plus className="size-4" /> Novo pagamento
                </Button>
              )
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <PagamentosList
              rows={rows.map((r) => ({
                id: r.id,
                tipo: r.tipo,
                showLabel: r.showId ? (showLabel.get(r.showId) ?? null) : null,
                descricao: r.descricao,
                recipient: r.recipient,
                valorCentavos: r.valorCentavos,
                paidEm: r.paidEm.toISOString(),
              }))}
              admin={admin}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
