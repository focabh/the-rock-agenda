import Link from "next/link";
import { asc } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/db";
import { equipamentos, members } from "@/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  EquipamentosManager,
  type EquipItem,
} from "@/components/equipamentos/equipamentos-manager";

export default async function EquipamentosPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);

  const [rows, allMembers] = await Promise.all([
    db.select().from(equipamentos).orderBy(asc(equipamentos.nome)),
    db.select().from(members).orderBy(asc(members.nome)),
  ]);
  const memberById = new Map(allMembers.map((m) => [m.id, m]));

  const itens: EquipItem[] = rows.map((e) => ({
    id: e.id,
    nome: e.nome,
    categoria: e.categoria,
    tipo: e.tipo,
    proprietarioId: e.proprietarioId,
    proprietarioNome: e.proprietarioId ? memberById.get(e.proprietarioId)?.nome ?? null : null,
    especificacoes: e.especificacoes,
  }));

  return (
    <div>
      <PageHeader
        title="Equipamentos"
        description="Inventário técnico da banda — o que é da banda, o que é de cada músico."
        actions={
          <Button variant="outline" size="sm" render={<Link href="/rider" target="_blank" />}>
            <FileText className="size-4" /> Rider Técnico
          </Button>
        }
      />
      <div className="p-6">
        <EquipamentosManager
          itens={itens}
          membros={allMembers.filter((m) => !m.isManager).map((m) => ({ id: m.id, nome: m.nome }))}
          canEdit={admin}
        />
      </div>
    </div>
  );
}
