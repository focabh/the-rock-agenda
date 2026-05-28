import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, appSettings } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { CadastrosManager } from "@/components/cadastros/cadastros-manager";
import { requireAdmin } from "@/lib/auth";

export default async function CadastrosPage() {
  const me = await requireAdmin();

  const [settings, pending, approved] = await Promise.all([
    db.select().from(appSettings).limit(1),
    db
      .select({
        id: users.id,
        apelido: users.apelido,
        nome: users.nome,
        sobrenome: users.sobrenome,
        username: users.username,
        email: users.email,
        telefone: users.telefone,
        chavePix: users.chavePix,
        posicao: users.posicao,
      })
      .from(users)
      .where(eq(users.status, "pendente")),
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

  return (
    <div>
      <PageHeader
        title="Cadastros"
        description="Libere ou feche novos cadastros, aprove acessos e gerencie quem é admin."
      />
      <div className="p-6 max-w-3xl">
        <CadastrosManager
          allowRegistrations={settings[0]?.allowRegistrations ?? true}
          pending={pending}
          approved={approved}
          currentUserId={me.id}
        />
      </div>
    </div>
  );
}
