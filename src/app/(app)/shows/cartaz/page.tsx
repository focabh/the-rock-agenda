import { and, gte, inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { requireCurrentUser, getBrand, getLogoUrl } from "@/lib/auth";
import { formatHoraBR } from "@/lib/formatters";
import { listImagensDivulgacao } from "@/app/(app)/shows/[id]/divulgacao/actions";
import { PageHeader } from "@/components/shared/page-header";
import { AgendaPosterStudio, type PosterShow } from "@/components/divulgacao/agenda-poster-studio";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default async function CartazAgendaPage() {
  await requireCurrentUser();

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const proximos = await db.query.shows.findMany({
    where: and(gte(shows.data, inicioHoje), inArray(shows.status, ["planejado", "confirmado"])),
    with: { casa: { columns: { nome: true } } },
    orderBy: [asc(shows.data)],
    limit: 60,
  });

  const [brand, logoUrl, galeria] = await Promise.all([
    getBrand(),
    getLogoUrl(),
    listImagensDivulgacao(),
  ]);

  const lista: PosterShow[] = proximos.map((s) => ({
    ts: s.data.getTime(),
    shortData: `${String(s.data.getDate()).padStart(2, "0")}/${String(s.data.getMonth() + 1).padStart(2, "0")}`,
    dia: DIAS[s.data.getDay()],
    hora: s.inicio || formatHoraBR(s.data),
    casa: s.casa.nome,
    cidade: s.cidade ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Cartaz da agenda"
        description="Pôster com os próximos shows pra postar no Instagram. Escolha o período e o fundo, e baixe — custo zero."
      />
      <div className="p-6">
        <AgendaPosterStudio
          banda={brand.bandName?.trim() || "The Rock"}
          logoUrl={logoUrl}
          shows={lista}
          galeria={galeria.map((g) => ({ id: g.id, url: g.url }))}
        />
      </div>
    </div>
  );
}
