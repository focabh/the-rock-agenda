import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, inviteTokens } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { CadastrosManager } from "@/components/cadastros/cadastros-manager";
import { requireAdmin } from "@/lib/auth";
import { inviteStatus } from "@/lib/invites";

export default async function CadastrosPage() {
  const me = await requireAdmin();

  const [inviteRows, approved] = await Promise.all([
    db.select().from(inviteTokens).orderBy(desc(inviteTokens.createdAt)),
    db
      .select({
        id: users.id,
        apelido: users.apelido,
        nome: users.nome,
        sobrenome: users.sobrenome,
        username: users.username,
        role: users.role,
        posicao: users.posicao,
      })
      .from(users)
      .where(eq(users.status, "aprovado")),
  ]);

  const invites = inviteRows.map((i) => ({
    id: i.id,
    token: i.token,
    telefone: i.telefone,
    nome: i.nome,
    status: inviteStatus(i),
    expiresEm: i.expiresEm.getTime(),
  }));

  return (
    <div>
      <PageHeader
        title="Convites"
        description="Convide novos membros por link, revogue convites e gerencie quem tem acesso e quem é admin."
      />
      <div className="p-6 max-w-3xl">
        <CadastrosManager
          invites={invites}
          approved={approved}
          currentUserId={me.id}
        />
      </div>
    </div>
  );
}
