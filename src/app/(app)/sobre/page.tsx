import { getCurrentUser, isAdmin, getBrand } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { BioEditor } from "@/components/sobre/bio-editor";

export default async function SobrePage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const brand = await getBrand();

  return (
    <div>
      <PageHeader
        title="Sobre a banda"
        description="O cartão de visitas da banda pra contratantes e fãs. Escreva à mão ou gere com IA — e compartilhe o link público."
      />
      <div className="p-6 max-w-2xl">
        <BioEditor initialTexto={brand.bioTexto} admin={admin} />
      </div>
    </div>
  );
}
