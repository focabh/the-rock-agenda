import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FunilBoard, type FunilCard, type Stage } from "@/components/casas/funil-board";

// Deriva o estágio quando ainda não foi definido à mão (a partir do CRM).
function deriveStage(v: typeof venues.$inferSelect): Stage {
  if (v.pipelineStage) return v.pipelineStage as Stage;
  if (v.jaTocou) return "fechado";
  if (v.materialEnviadoEm) return "material";
  return "novo";
}

export default async function FunilPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/casas");

  const all = await db.select().from(venues).where(eq(venues.ativo, true)).orderBy(asc(venues.nome));

  // Foco do funil: casas relevantes pra prospecção (não as "não contatar").
  const relevantes = all.filter(
    (v) => !v.naoContatar && (v.querTocar || v.jaTocou || v.materialEnviadoEm || v.pipelineStage)
  );

  const cards: FunilCard[] = relevantes.map((v) => ({
    id: v.id,
    nome: v.nome,
    cidade: [v.bairro, v.cidade].filter(Boolean).join(" · "),
    contato: v.contatoPrincipal,
    materialEnviadoEm: v.materialEnviadoEm ? v.materialEnviadoEm.getTime() : null,
    ultimoContatoEm: v.ultimoContatoEm ? v.ultimoContatoEm.getTime() : null,
    stage: deriveStage(v),
  }));

  return (
    <div>
      <PageHeader
        title="Funil de prospecção"
        description="Acompanhe bares e casas por etapa: do primeiro contato ao show fechado."
        actions={
          <Button variant="outline" size="sm" render={<Link href="/casas" />}>
            <ArrowLeft className="size-4" /> Lista de casas
          </Button>
        }
      />
      <div className="p-4 sm:p-6">
        <FunilBoard cards={cards} />
      </div>
    </div>
  );
}
