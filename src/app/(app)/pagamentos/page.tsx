import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { Plus, Wallet, ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { reembolsos, showMemberPaid, members, shows } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import {
  PagamentosList,
  type PagamentoRow,
} from "@/components/pagamentos/pagamentos-list";

export default async function PagamentosPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const meMemberId = user?.member?.id ?? null;

  // Membros para resolver nomes
  const allMembers = await db.select().from(members);
  const memberById = new Map(allMembers.map((m) => [m.id, m]));

  // Cachês (banda → músico) — select direto, sem relação definida no schema.
  const cacheRows = await db.select().from(showMemberPaid);

  // Carrega shows referenciados pelos cachês pra mostrar a casa/data.
  const showIds = Array.from(new Set(cacheRows.map((r) => r.showId)));
  const showsLookup =
    showIds.length === 0
      ? []
      : await db.query.shows.findMany({
          where: inArray(shows.id, showIds),
          columns: { id: true, data: true },
          with: { casa: { columns: { nome: true } } },
        });
  const showById = new Map(showsLookup.map((s) => [s.id, s]));

  // Reembolsos
  const reembRows = await db
    .select()
    .from(reembolsos)
    .orderBy(desc(reembolsos.paidEm));

  // Monta a lista unificada
  const rows: PagamentoRow[] = [];
  for (const r of cacheRows) {
    if (!admin && r.memberId !== meMemberId) continue;
    const s = showById.get(r.showId);
    const m = memberById.get(r.memberId);
    rows.push({
      kind: "cache",
      id: `cache-${r.showId}-${r.memberId}`,
      showId: r.showId,
      memberId: r.memberId,
      memberNome: m?.nome ?? "—",
      descricao: s ? `Cachê — ${s.casa.nome}` : "Cachê do show",
      contexto: s ? formatDataBR(s.data) : null,
      // valor não está em show_member_paid; deixamos null aqui (vive na repartição)
      valorCentavos: null,
      status:
        (r.status ?? "confirmado") === "aguardando"
          ? "aguardando"
          : "confirmado",
      hasComprovante: Boolean(r.comprovante),
      paidEm: r.pagoEm.toISOString(),
    });
  }
  for (const r of reembRows) {
    if (!admin && r.memberId !== meMemberId) continue;
    const m = memberById.get(r.memberId);
    rows.push({
      kind: "reembolso",
      id: r.id,
      showId: null,
      memberId: r.memberId,
      memberNome: m?.nome ?? "—",
      descricao: r.descricao,
      contexto: "Reembolso",
      valorCentavos: r.valorCentavos,
      status: r.status,
      hasComprovante: Boolean(r.comprovante),
      paidEm: r.paidEm.toISOString(),
    });
  }
  rows.sort((a, b) => b.paidEm.localeCompare(a.paidEm));

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        description={
          admin
            ? "Cachês pagos aos músicos e reembolsos. Para gastos da banda (equipamento etc.), use a seção Gastos."
            : "Seu histórico de cachês e reembolsos. Confirme o recebimento quando o admin marcar um pagamento."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" render={<Link href="/" />}>
              <ChevronLeft className="size-4" /> Painel
            </Button>
            {admin && (
              <Button size="sm" render={<Link href="/pagamentos/novo" />}>
                <Plus className="size-4" /> Novo reembolso
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum pagamento por aqui"
            description={
              admin
                ? "Cachês de show aparecem aqui automaticamente quando você marca um músico como pago no detalhe do show. Pra registrar um reembolso, use o botão acima."
                : "Quando o admin registrar um pagamento pra você, aparece aqui pra confirmar o recebimento."
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <PagamentosList
              rows={rows}
              currentMemberId={meMemberId}
              admin={admin}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
