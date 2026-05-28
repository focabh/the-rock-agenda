import Link from "next/link";
import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { Plus, ChevronLeft } from "lucide-react";
import { db } from "@/db";
import {
  shows,
  members,
  showMemberPresence,
  showMemberPayment,
  showMemberPaid,
  reembolsos,
} from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Wallet } from "lucide-react";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import { computePaymentBreakdown } from "@/lib/payment";
import {
  PagamentosHub,
  type CacheItem,
  type ReembolsoItem,
  type ContratanteItem,
} from "@/components/pagamentos/pagamentos-hub";

export default async function PagamentosPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const meMemberId = user?.member?.id ?? null;

  const allMembers = await db.select().from(members);
  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  const managerMember = allMembers.find((m) => m.isManager) ?? null;
  const playable = allMembers.filter((m) => !m.isManager && m.ativo);

  // Shows com cachê definido e em estados pagáveis (confirmado/concluído).
  const payableShows = await db.query.shows.findMany({
    where: and(
      gt(shows.cacheCentavos, 0),
      inArray(shows.status, ["confirmado", "concluido"])
    ),
    with: { casa: { columns: { nome: true } } },
    orderBy: (s, { desc }) => [desc(s.data)],
  });
  const showIds = payableShows.map((s) => s.id);

  const [presences, overrides, paidRows] = await Promise.all([
    showIds.length
      ? db
          .select()
          .from(showMemberPresence)
          .where(inArray(showMemberPresence.showId, showIds))
      : Promise.resolve([] as (typeof showMemberPresence.$inferSelect)[]),
    showIds.length
      ? db
          .select()
          .from(showMemberPayment)
          .where(inArray(showMemberPayment.showId, showIds))
      : Promise.resolve([] as (typeof showMemberPayment.$inferSelect)[]),
    showIds.length
      ? db
          .select()
          .from(showMemberPaid)
          .where(inArray(showMemberPaid.showId, showIds))
      : Promise.resolve([] as (typeof showMemberPaid.$inferSelect)[]),
  ]);

  const confirmedByShow = new Map<string, Set<string>>();
  for (const p of presences) {
    if (p.status !== "confirmado") continue;
    if (!confirmedByShow.has(p.showId)) confirmedByShow.set(p.showId, new Set());
    confirmedByShow.get(p.showId)!.add(p.memberId);
  }

  const overridesByShow = new Map<string, Map<string, number>>();
  for (const o of overrides) {
    if (!overridesByShow.has(o.showId))
      overridesByShow.set(o.showId, new Map());
    overridesByShow.get(o.showId)!.set(o.memberId, o.valorCentavos);
  }

  const paidByKey = new Map<
    string,
    { status: "aguardando" | "confirmado"; hasComprovante: boolean; pagoEm: Date }
  >();
  for (const r of paidRows) {
    paidByKey.set(`${r.showId}-${r.memberId}`, {
      status: (r.status ?? "confirmado") as "aguardando" | "confirmado",
      hasComprovante: Boolean(r.comprovante),
      pagoEm: r.pagoEm,
    });
  }

  // Constrói itens de cachê (uma linha por show × músico confirmado).
  const cacheItems: CacheItem[] = [];
  for (const s of payableShows) {
    const confirmedIds = confirmedByShow.get(s.id) ?? new Set<string>();
    const confirmedMusicos = playable.filter((m) => confirmedIds.has(m.id));
    if (confirmedMusicos.length === 0) continue;

    const breakdown = computePaymentBreakdown({
      cacheCentavos: s.cacheCentavos ?? 0,
      applyCommission: s.applyCommission,
      commissionPct: s.commissionPct,
      confirmedMusicos,
      managerMember,
      overrides: overridesByShow.get(s.id) ?? new Map(),
    });

    for (const m of confirmedMusicos) {
      if (!admin && m.id !== meMemberId) continue;
      const info = breakdown.perMember.get(m.id);
      if (!info) continue;
      const paid = paidByKey.get(`${s.id}-${m.id}`);
      const status: CacheItem["status"] = !paid
        ? "a_pagar"
        : paid.status === "aguardando"
          ? "aguardando"
          : "confirmado";
      cacheItems.push({
        showId: s.id,
        showLabel: `${s.casa.nome} — ${formatDataBR(s.data)}`,
        showData: s.data.toISOString(),
        memberId: m.id,
        memberNome: memberById.get(m.id)?.nome ?? "—",
        valorCentavos: info.valorCentavos,
        status,
        hasComprovante: paid?.hasComprovante ?? false,
        pagoEmISO: paid?.pagoEm.toISOString() ?? null,
      });
    }
  }

  // Reembolsos
  const reembolsoRows = await db
    .select()
    .from(reembolsos)
    .orderBy(desc(reembolsos.paidEm));
  const reembolsoItems: ReembolsoItem[] = reembolsoRows
    .filter((r) => admin || r.memberId === meMemberId)
    .map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberNome: memberById.get(r.memberId)?.nome ?? "—",
      descricao: r.descricao,
      valorCentavos: r.valorCentavos,
      status: r.status,
      hasComprovante: Boolean(r.comprovante),
      paidEmISO: r.paidEm.toISOString(),
    }));

  // Cachês a receber do contratante (só admin precisa)
  let contratanteItems: ContratanteItem[] = [];
  if (admin) {
    const pendingFromContratante = await db.query.shows.findMany({
      where: and(eq(shows.status, "concluido"), ne(shows.pagamentoStatus, "pago")),
      with: { casa: { columns: { nome: true } } },
      orderBy: (s, { asc }) => [asc(s.data)],
    });
    contratanteItems = pendingFromContratante.map((s) => ({
      showId: s.id,
      showLabel: s.casa.nome,
      showData: s.data.toISOString(),
      valorCentavos: s.cacheCentavos ?? 0,
      pagamentoStatus: s.pagamentoStatus,
    }));
  }

  const isEmpty =
    cacheItems.length === 0 &&
    reembolsoItems.length === 0 &&
    contratanteItems.length === 0;

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        description={
          admin
            ? "Cachês a pagar aos músicos, cachês a receber do contratante e reembolsos. Comprovante PIX obrigatório em todos."
            : "Seus cachês e reembolsos. Confirme o recebimento quando o admin marcar um pagamento."
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

      <div className="p-6 space-y-6">
        {isEmpty ? (
          <Card>
            <EmptyState
              icon={Wallet}
              title="Tudo em dia"
              description={
                admin
                  ? "Não há cachês ou reembolsos pendentes. Quando um show com músicos confirmados acontecer, eles aparecem aqui pra pagar."
                  : "Não há pagamentos pendentes pra você no momento."
              }
            />
          </Card>
        ) : (
          <PagamentosHub
            cacheItems={cacheItems}
            reembolsoItems={reembolsoItems}
            contratanteItems={contratanteItems}
            admin={admin}
            currentMemberId={meMemberId}
          />
        )}
      </div>
    </div>
  );
}
