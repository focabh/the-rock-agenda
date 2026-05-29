import Link from "next/link";
import { desc } from "drizzle-orm";
import { Plus, Wallet } from "lucide-react";
import { db } from "@/db";
import { gastos } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import { GastosList } from "@/components/gastos/gastos-list";

export default async function GastosPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);

  const rows = await db.select().from(gastos).orderBy(desc(gastos.paidEm));

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
        title="Gastos da banda"
        description="Investimentos e despesas da banda (equipamento, divulgação, transporte). Cachê pago a músicos fica em Pagamentos."
        actions={
          <div className="flex items-center gap-2">
            {admin && (
              <Button size="sm" render={<Link href="/gastos/novo" />}>
                <Plus className="size-4" /> Novo gasto
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum gasto registrado"
            description={
              admin
                ? "Registre o primeiro gasto da banda — equipamento, divulgação, transporte. Anexe o comprovante."
                : "Os admins ainda não registraram gastos."
            }
            action={
              admin && (
                <Button render={<Link href="/gastos/novo" />}>
                  <Plus className="size-4" /> Novo gasto
                </Button>
              )
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <GastosList
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
