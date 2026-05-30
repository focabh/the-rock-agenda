import { asc } from "drizzle-orm";
import { db } from "@/db";
import { bandPositions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { PositionsManager } from "@/components/posicoes/positions-manager";

export default async function PosicoesPage() {
  await requireAdmin();
  const positions = await db
    .select()
    .from(bandPositions)
    .orderBy(asc(bandPositions.ordem), asc(bandPositions.nome));

  return (
    <div>
      <PageHeader
        title="Posições"
        description="Posições/instrumentos da banda. Vários músicos podem ter a mesma. Aparecem no cadastro/convite e nos atalhos por posição."
      />
      <div className="p-6 max-w-2xl">
        <PositionsManager positions={positions} />
      </div>
    </div>
  );
}
