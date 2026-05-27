import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, MapPin, Clock, Target, StickyNote } from "lucide-react";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EnsaioStatusBadge } from "@/components/agenda/ensaio-status-badge";
import { formatDataExtensa } from "@/lib/formatters";
import { getCurrentUser, isAdmin } from "@/lib/auth";

function mapsUrl(r: { latitude: number | null; longitude: number | null; endereco: string | null }) {
  if (r.latitude != null && r.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`;
  }
  if (r.endereco) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.endereco)}`;
  }
  return null;
}

export default async function EnsaioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [r] = await db.select().from(rehearsals).where(eq(rehearsals.id, id)).limit(1);
  if (!r) notFound();

  const admin = isAdmin(await getCurrentUser());
  const maps = mapsUrl(r);
  const Item = ({
    icon: Icon,
    label,
    children,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-start gap-3">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Ensaio"
        description={formatDataExtensa(r.data)}
        actions={
          <div className="flex items-center gap-2">
            <Button render={<Link href="/ensaios" />} variant="outline" size="sm">
              <ArrowLeft className="size-4" /> Voltar
            </Button>
            {admin && (
              <Button
                render={<Link href={`/ensaios/${r.id}/editar`} />}
                size="sm"
              >
                <Pencil className="size-4" /> Editar
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 max-w-2xl">
        <Card>
          <CardContent className="py-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold capitalize">
                {formatDataExtensa(r.data)}
              </span>
              <EnsaioStatusBadge status={r.status} />
            </div>

            {(r.inicio || r.termino) && (
              <Item icon={Clock} label="Horário">
                {r.inicio}
                {r.termino ? ` às ${r.termino}` : ""}
              </Item>
            )}

            {(r.local || r.endereco) && (
              <Item icon={MapPin} label="Local">
                {r.local && <p>{r.local}</p>}
                {r.endereco && (
                  <p className="text-muted-foreground">{r.endereco}</p>
                )}
                {maps && (
                  <a
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs"
                  >
                    Ver no mapa →
                  </a>
                )}
              </Item>
            )}

            {r.foco && (
              <Item icon={Target} label="Foco do ensaio">
                {r.foco}
              </Item>
            )}

            {r.observacoes && (
              <Item icon={StickyNote} label="Observações">
                <p className="whitespace-pre-wrap">{r.observacoes}</p>
              </Item>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
