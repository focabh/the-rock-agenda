import { eq, gte, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { members, memberUnavailability, users } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { MemberForm } from "@/components/banda/member-form";
import { UnavailabilitySection } from "@/components/banda/unavailability-section";
import { AccessSection } from "@/components/banda/access-section";
import { Card, CardContent } from "@/components/ui/card";
import { updateMemberAction } from "../actions";
import { getCurrentUser, isAdmin, getAvailablePositions } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";

export default async function EditarMembroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const admin = isAdmin(currentUser);

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  if (!member) notFound();

  const linkedUser = member.userId
    ? (await db.select().from(users).where(eq(users.id, member.userId)).limit(1))[0]
    : null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const blocks = await db
    .select()
    .from(memberUnavailability)
    .where(
      and(
        eq(memberUnavailability.memberId, id),
        gte(memberUnavailability.dataFim, now)
      )
    );

  const action = updateMemberAction.bind(null, id);
  const isSelf = currentUser?.member?.id === member.id;
  const canEditUnavailability = admin || isSelf;
  const positions = admin ? await getAvailablePositions() : [];

  return (
    <div>
      <PageHeader title={member.nome} description={member.funcao} />
      <div className="p-6 max-w-3xl space-y-6">
        {admin ? (
          <MemberForm
            member={member}
            action={action}
            submitLabel="Salvar alterações"
            positions={positions}
          />
        ) : (
          <ReadOnlyMember member={member} />
        )}
        {admin && (
          <AccessSection
            memberId={id}
            linkedUsername={linkedUser?.username ?? null}
            linkedRole={linkedUser?.role ?? null}
          />
        )}
        {canEditUnavailability ? (
          <UnavailabilitySection memberId={id} blocks={blocks} />
        ) : (
          <ReadOnlyUnavailability blocks={blocks} />
        )}
      </div>
    </div>
  );
}

function ReadOnlyMember({ member }: { member: typeof members.$inferSelect }) {
  return (
    <Card>
      <CardContent className="py-5 space-y-3 text-sm">
        <Row label="Função" value={member.funcao} />
        {member.telefone && <Row label="Telefone" value={member.telefone} />}
        {member.percentualDivisao != null && member.percentualDivisao > 0 && (
          <Row label="Divisão" value={`${member.percentualDivisao}%`} />
        )}
        {member.equipamentos && <Row label="Equipamentos" value={member.equipamentos} />}
        {member.disponibilidade && (
          <Row label="Disponibilidade" value={member.disponibilidade} />
        )}
        {member.observacoes && <Row label="Observações" value={member.observacoes} />}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap mt-0.5">{value}</p>
    </div>
  );
}

function ReadOnlyUnavailability({
  blocks,
}: {
  blocks: typeof memberUnavailability.$inferSelect[];
}) {
  if (blocks.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Sem indisponibilidades futuras.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Indisponibilidades
        </p>
        <ul className="text-sm space-y-2">
          {blocks
            .sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime())
            .map((b) => (
              <li key={b.id}>
                {formatDataBR(b.dataInicio)}
                {formatDataBR(b.dataInicio) !== formatDataBR(b.dataFim) &&
                  ` → ${formatDataBR(b.dataFim)}`}
                {(b.horaInicio || b.horaFim) && (
                  <span className="font-mono text-muted-foreground ml-1.5 text-xs">
                    {b.horaInicio && b.horaFim
                      ? `${b.horaInicio}–${b.horaFim}`
                      : b.horaInicio
                        ? `a partir de ${b.horaInicio}`
                        : `até ${b.horaFim}`}
                  </span>
                )}
                {b.motivo && (
                  <span className="text-muted-foreground"> — {b.motivo}</span>
                )}
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
