import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCurrentUser, getBrand } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/shared/print-button";
import { GuiaDoc } from "@/components/guia/guia-doc";

export default async function GuiaMusicoPage() {
  await requireCurrentUser();
  const brand = await getBrand();
  const banda = brand.bandName?.trim() || "The Rock";

  return (
    <div className="min-h-screen bg-white">
      <div className="no-print flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2.5">
        <Button render={<Link href="/guia" />} variant="ghost" size="sm" className="text-zinc-700 hover:bg-zinc-100">
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <PrintButton label="Salvar PDF" />
      </div>
      <GuiaDoc perfil="musico" banda={banda} />
    </div>
  );
}
