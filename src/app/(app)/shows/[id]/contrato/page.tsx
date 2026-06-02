import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { getCurrentUser, isAdmin, getBrand } from "@/lib/auth";
import { formatDataExtensa } from "@/lib/formatters";
import { ContratoView, type ContratoData } from "@/components/shows/contrato-view";

export default async function ContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect(`/shows/${id}`); // contrato/recibo é coisa de admin/manager

  const show = await db.query.shows.findFirst({
    where: eq(shows.id, id),
    with: { casa: { columns: { nome: true } } },
  });
  if (!show) notFound();

  const brand = await getBrand();
  const cidadeUf = [show.cidade, show.estado].filter(Boolean).join(" / ");

  const data: ContratoData = {
    showId: show.id,
    bandName: brand.bandName || "Banda",
    logoUrl: brand.logoUrl,
    casa: show.casa.nome,
    contatoNome: show.contatoNome,
    contatoTelefone: show.contatoTelefone,
    local: show.endereco || show.casa.nome,
    cidadeUf,
    dataExtensa: formatDataExtensa(show.data),
    inicio: show.inicio,
    termino: show.termino,
    cacheCentavos: show.cacheCentavos ?? 0,
    privado: show.privado,
  };

  return <ContratoView data={data} />;
}
