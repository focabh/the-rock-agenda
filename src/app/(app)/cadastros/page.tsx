import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, appSettings } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { CadastrosManager } from "@/components/cadastros/cadastros-manager";
import { requireAdmin } from "@/lib/auth";

export default async function CadastrosPage() {
  await requireAdmin();

  const [settings, pending] = await Promise.all([
    db.select().from(appSettings).limit(1),
    db
      .select({
        id: users.id,
        nome: users.nome,
        username: users.username,
        email: users.email,
        telefone: users.telefone,
        chavePix: users.chavePix,
      })
      .from(users)
      .where(eq(users.status, "pendente")),
  ]);

  return (
    <div>
      <PageHeader
        title="Cadastros"
        description="Libere ou feche novos cadastros e aprove quem pediu acesso."
      />
      <div className="p-6 max-w-3xl">
        <CadastrosManager
          allowRegistrations={settings[0]?.allowRegistrations ?? true}
          pending={pending}
        />
      </div>
    </div>
  );
}
