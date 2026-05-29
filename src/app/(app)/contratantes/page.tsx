import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { ChevronLeft, Eye, Calendar, MapPin } from "lucide-react";
import { db } from "@/db";
import { promoItems, siteVisits } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { SharePanel } from "@/components/contratantes/share-panel";
import { formatDataBR } from "@/lib/formatters";

export default async function ContratantesPage() {
  await requireCurrentUser();

  // Vídeos disponíveis (pra checkbox-list de seleção no SharePanel).
  const videosRaw = await db
    .select({ id: promoItems.id, titulo: promoItems.titulo })
    .from(promoItems)
    .where(eq(promoItems.tipo, "video"))
    .orderBy(asc(promoItems.ordem), asc(promoItems.createdAt));

  // Estatísticas de visitas à página fixa /show.
  const visits = await db
    .select()
    .from(siteVisits)
    .orderBy(desc(siteVisits.visitedAt));

  const now = Date.now();
  const D7 = 7 * 86_400_000;
  const D30 = 30 * 86_400_000;
  const total = visits.length;
  const last7 = visits.filter((v) => now - v.visitedAt.getTime() < D7).length;
  const last30 = visits.filter((v) => now - v.visitedAt.getTime() < D30).length;
  const last = visits[0] ?? null;
  const uniqueIps = new Set(visits.map((v) => v.ip).filter(Boolean)).size;

  return (
    <div>
      <PageHeader
        title="Divulgação"
        description="Link único da banda pra mandar pra contratantes. Envie por WhatsApp e acompanhe quantas pessoas abriram."
        actions={
          <Button variant="outline" size="sm" render={<Link href="/" />}>
            <ChevronLeft className="size-4" /> Painel
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <SharePanel videos={videosRaw} />

        {/* Stats agregadas */}
        <Card className="p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Estatísticas
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Conta só visitas de contratantes — quando você (admin/músico) abre
              o link logado, não conta como visita.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total de visitas" value={total} />
            <Stat label="Últimos 7 dias" value={last7} />
            <Stat label="Últimos 30 dias" value={last30} />
            <Stat label="Dispositivos únicos" value={uniqueIps} />
          </div>
          {last && (
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-3.5" />
                Última visita
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {formatDataBR(last.visitedAt)}
              </span>
              {last.city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {last.city}
                  {last.country ? `, ${last.country}` : ""}
                </span>
              )}
            </div>
          )}
          {total === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma visita registrada ainda. Manda o link pra alguém e volta
              aqui pra ver.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card/50 px-3 py-2.5">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
