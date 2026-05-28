import Link from "next/link";
import { asc } from "drizzle-orm";
import { ChevronLeft, Megaphone } from "lucide-react";
import { db } from "@/db";
import { promoItems } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { DivulgacaoManager } from "@/components/divulgacao/divulgacao-manager";

export default async function DivulgacaoPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);

  const items = await db
    .select()
    .from(promoItems)
    .orderBy(asc(promoItems.tipo), asc(promoItems.ordem), asc(promoItems.createdAt));

  return (
    <div>
      <PageHeader
        title="Divulgação"
        description="Material da banda — vídeos, fotos, logo e press kit. Compartilhe com contratantes."
        actions={
          <Button variant="outline" size="sm" render={<Link href="/" />}>
            <ChevronLeft className="size-4" /> Painel
          </Button>
        }
      />
      <div className="p-6">
        <DivulgacaoManager
          items={items.map((i) => ({
            id: i.id,
            tipo: i.tipo,
            titulo: i.titulo,
            url: i.url,
            descricao: i.descricao,
            cover: i.cover,
          }))}
          admin={admin}
        />
        {items.length === 0 && !admin && (
          <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
            <Megaphone className="size-4" />
            Os admins ainda não cadastraram material de divulgação.
          </p>
        )}
      </div>
    </div>
  );
}
