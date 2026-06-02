import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { shows, promoItems } from "@/db/schema";
import { requireCurrentUser, getBrand, getLogoUrl } from "@/lib/auth";
import { formatDataBR, formatHoraBR } from "@/lib/formatters";
import { PageHeader } from "@/components/shared/page-header";
import { FlyerStudio } from "@/components/divulgacao/flyer-studio";
import { listImagensDivulgacao } from "./actions";

export default async function DivulgacaoShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCurrentUser(); // flyer disponível a todos os membros logados

  const show = await db.query.shows.findFirst({
    where: eq(shows.id, id),
    with: { casa: { columns: { nome: true, instagram: true, logoUrl: true } } },
  });
  if (!show) notFound();

  const [brand, logoUrl, galeria, fotosBanda] = await Promise.all([
    getBrand(),
    getLogoUrl(),
    listImagensDivulgacao(),
    db.select({ id: promoItems.id, url: promoItems.url }).from(promoItems).where(eq(promoItems.tipo, "foto")).orderBy(desc(promoItems.ordem)),
  ]);

  // Galeria do flyer = fotos enviadas aqui (removíveis) + material de divulgação
  // da banda (fotos), que ficam selecionáveis mas não são apagadas por aqui.
  const galeriaFull = [
    ...galeria.map((g) => ({ id: g.id, url: g.url, removable: true })),
    ...fotosBanda.map((f) => ({ id: `promo-${f.id}`, url: f.url, removable: false })),
  ];

  return (
    <div>
      <PageHeader
        title="Flyer do show"
        description="Monte um cartaz pro Instagram com a foto do bar (ou da banda), os dados do show e QR de ingressos. Baixa como imagem — custo zero."
      />
      <div className="p-6">
        <FlyerStudio
          show={{
            banda: brand.bandName?.trim() || "The Rock",
            casaNome: show.casa.nome,
            cidade: show.cidade,
            dataLabel: formatDataBR(show.data, true),
            inicio: show.inicio || formatHoraBR(show.data),
            termino: show.termino,
            valorIngresso: show.valorIngresso,
            linkVendas: show.linkVendas,
            logoUrl,
            casaInstagram: show.casa.instagram,
            casaLogoUrl: show.casa.logoUrl,
            privado: show.privado,
          }}
          galeria={galeriaFull}
        />
      </div>
    </div>
  );
}
