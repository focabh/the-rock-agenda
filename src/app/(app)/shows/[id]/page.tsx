import { eq, asc, and, lte, gte } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import {
  shows,
  songs,
  checklistTemplates,
  members,
  memberUnavailability,
  showMemberPresence,
  showMemberPayment,
  showMemberPaid,
  gastos,
} from "@/db/schema";
import { membersUnavailableOn } from "@/lib/conflicts";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { PresenceCard } from "@/components/shows/presence-card";
import { setPresenceAction } from "@/app/(app)/shows/[id]/actions-presence";
import { PaymentBreakdown } from "@/components/shows/payment-breakdown";
import { PageHeader } from "@/components/shared/page-header";
import { ShowDetailTabs } from "@/components/shows/show-detail-tabs";
import { ShowResumo } from "@/components/shows/show-resumo";
import { VenueShowCard } from "@/components/casas/venue-show-card";
import { parseTags } from "@/lib/venue-tags";
import { SetlistTab } from "@/components/shows/setlist-tab";
import { ChecklistTab } from "@/components/shows/checklist-tab";
import { AvaliacaoTab } from "@/components/shows/avaliacao-tab";
import { PropostaTab } from "@/components/shows/proposta-tab";
import { Button } from "@/components/ui/button";
import { NotifyBandButton } from "@/components/shared/notify-band-button";
import { formatDataBR } from "@/lib/formatters";

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const show = await db.query.shows.findFirst({
    where: eq(shows.id, id),
    with: {
      casa: true,
      setlists: { with: { items: { with: { song: true } } } },
      checklists: { with: { items: true, template: true } },
      avaliacao: true,
    },
  });
  if (!show) notFound();

  const proposta = await db.query.showPropostas.findFirst({
    where: (sp, { eq }) => eq(sp.showId, id),
  });

  const [allSongs, allTemplates, allMembers, dayBlocks, presences, payments, paidRows] = await Promise.all([
    db.select().from(songs).orderBy(asc(songs.titulo)),
    db.select().from(checklistTemplates).orderBy(asc(checklistTemplates.nome)),
    db.select().from(members).where(eq(members.ativo, true)).orderBy(asc(members.nome)),
    // Janela ampla (±2 dias) — depois filtramos com precisão via brDateKey
    db
      .select()
      .from(memberUnavailability)
      .where(
        and(
          lte(
            memberUnavailability.dataInicio,
            new Date(show.data.getTime() + 2 * 86400_000)
          ),
          gte(
            memberUnavailability.dataFim,
            new Date(show.data.getTime() - 2 * 86400_000)
          )
        )
      ),
    db
      .select()
      .from(showMemberPresence)
      .where(eq(showMemberPresence.showId, id)),
    db
      .select()
      .from(showMemberPayment)
      .where(eq(showMemberPayment.showId, id)),
    db
      .select()
      .from(showMemberPaid)
      .where(eq(showMemberPaid.showId, id)),
  ]);

  // Não-managers
  const playableMembers = allMembers.filter((m) => !m.isManager);
  // Confirmados
  const confirmedIds = new Set(
    presences.filter((p) => p.status === "confirmado").map((p) => p.memberId)
  );
  const confirmedMusicos = playableMembers.filter((m) => confirmedIds.has(m.id));
  const managerMember = allMembers.find((m) => m.isManager) ?? null;

  const conflitos = membersUnavailableOn(show.data, dayBlocks, allMembers);
  const now = new Date();

  // Sobre a casa: já tocou lá antes? última apresentação? (§15)
  const casaShows = await db
    .select({ sid: shows.id, data: shows.data })
    .from(shows)
    .where(eq(shows.casaId, show.casaId));
  const pastOutras = casaShows
    .filter((s) => s.sid !== show.id && s.data.getTime() <= now.getTime())
    .sort((a, b) => b.data.getTime() - a.data.getTime());
  const ultimaAprCasa =
    [pastOutras[0]?.data ?? null, show.casa.ultimaApresentacaoManual]
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const jaTocouCasa = show.casa.jaTocou || pastOutras.length > 0;

  // Gastos vinculados a este show → lucro líquido real (cachê − gastos).
  const gastosShow = await db
    .select({ v: gastos.valorCentavos })
    .from(gastos)
    .where(eq(gastos.showId, id));
  const gastosCentavos = gastosShow.reduce((s, g) => s + (g.v ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={show.casa.nome}
        description={formatDataBR(show.data, true)}
        actions={
          <div className="flex items-center gap-2">
            {admin && (
              <NotifyBandButton
                title={`Show: ${show.casa.nome}`}
                body={`${formatDataBR(show.data, true)}${
                  show.termino ? ` até ${show.termino}` : ""
                } — confirme sua presença!`}
                url={`/shows/${show.id}`}
                tag={`show-${show.id}`}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/shows" />}
            >
              <ChevronLeft className="size-4" />
              Voltar
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <ShowDetailTabs
          resumo={
            <div className="space-y-4">
              <ShowResumo
                show={show}
                casa={show.casa}
                conflitos={conflitos}
                admin={admin}
                gastosCentavos={gastosCentavos}
              />
              <VenueShowCard
                casaId={show.casaId}
                tags={parseTags(show.casa.caracteristicas)}
                perfil={show.casa.perfilPublico}
                jaTocou={jaTocouCasa}
                ultimaApresentacaoStr={
                  ultimaAprCasa ? formatDataBR(ultimaAprCasa) : null
                }
              />
              <PresenceCard
                eventId={show.id}
                action={setPresenceAction}
                members={playableMembers}
                presences={presences}
                currentMemberId={user?.member?.id ?? null}
                admin={admin}
                wa={{
                  label: "show",
                  quando: `dia ${formatDataBR(show.data, true)}${
                    show.termino ? ` até ${show.termino}` : ""
                  }`,
                  local: show.casa.nome,
                  path: `/shows/${show.id}`,
                }}
              />
              <PaymentBreakdown
                showId={show.id}
                cacheCentavos={show.cacheCentavos ?? 0}
                applyCommission={show.applyCommission}
                commissionPct={show.commissionPct}
                confirmedMusicos={confirmedMusicos}
                managerMember={managerMember}
                overrides={payments}
                paidInfo={paidRows.map((p) => ({
                  memberId: p.memberId,
                  // linha legada (sem status) = já confirmada
                  status: (p.status ?? "confirmado") as
                    | "aguardando"
                    | "confirmado",
                  hasComprovante: Boolean(p.comprovante),
                }))}
                currentMemberId={user?.member?.id ?? null}
                admin={admin}
              />
            </div>
          }
          setlist={
            <SetlistTab
              showId={show.id}
              setlists={show.setlists}
              allSongs={allSongs}
              canEdit={admin}
              defaultDuracaoMin={show.duracaoMin ?? 60}
            />
          }
          checklist={
            <ChecklistTab
              showId={show.id}
              templates={allTemplates}
              checklists={show.checklists}
            />
          }
          avaliacao={
            <AvaliacaoTab showId={show.id} avaliacao={show.avaliacao ?? null} />
          }
          proposta={
            <PropostaTab showId={show.id} proposta={proposta ?? null} />
          }
        />
      </div>
    </div>
  );
}
