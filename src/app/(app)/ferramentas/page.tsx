import { PageHeader } from "@/components/shared/page-header";
import { FerramentasClient } from "@/components/ferramentas/ferramentas-client";

export default function FerramentasPage() {
  return (
    <div>
      <PageHeader
        title="Afinador & Metrônomo"
        description="Ferramentas de ensaio — afine pelo microfone e marque o tempo. Funciona offline, no seu aparelho."
      />
      <FerramentasClient />
    </div>
  );
}
