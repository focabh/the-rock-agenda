import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DescobrirCasas } from "@/components/casas/descobrir-casas";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function DescobrirCasasPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/casas");

  return (
    <div>
      <PageHeader
        title="Descobrir casas"
        description="Encontra bares/casas perto de você que combinam com o perfil da banda. Adicione com 1 toque."
        actions={
          <Button render={<Link href="/casas" />} variant="outline" size="sm">
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        }
      />
      <div className="p-6 max-w-3xl">
        <DescobrirCasas />
      </div>
    </div>
  );
}
