import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc, asc } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { members, gastos } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatBRL, formatDataBR } from "@/lib/formatters";
import { NewReembolsoForm } from "@/components/pagamentos/new-reembolso-form";

export default async function NewReembolsoPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/pagamentos");

  const [musicos, gastosRecentes] = await Promise.all([
    db
      .select({ id: members.id, nome: members.nome, funcao: members.funcao })
      .from(members)
      .where(eq(members.ativo, true))
      .orderBy(asc(members.nome)),
    db
      .select({
        id: gastos.id,
        descricao: gastos.descricao,
        valorCentavos: gastos.valorCentavos,
        paidEm: gastos.paidEm,
      })
      .from(gastos)
      .orderBy(desc(gastos.paidEm))
      .limit(30),
  ]);

  return (
    <div>
      <PageHeader
        title="Novo reembolso"
        description="Pague um músico que bancou um gasto da banda. Anexe o comprovante PIX."
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/pagamentos" />}
          >
            <ChevronLeft className="size-4" /> Voltar
          </Button>
        }
      />
      <div className="p-6 max-w-2xl">
        <NewReembolsoForm
          musicos={musicos.map((m) => ({
            id: m.id,
            label: `${m.nome}${m.funcao ? ` — ${m.funcao}` : ""}`,
          }))}
          gastos={gastosRecentes.map((g) => ({
            id: g.id,
            label: `${g.descricao} · ${formatBRL(g.valorCentavos)} · ${formatDataBR(g.paidEm)}`,
          }))}
        />
      </div>
    </div>
  );
}
