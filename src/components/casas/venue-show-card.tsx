import Link from "next/link";
import { Building2, CheckCircle2, CalendarCheck, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Resumo da casa exibido na tela do Show — perfil/características, se a banda
 * já tocou lá e quando, com link pro CRM da casa. (§15)
 */
export function VenueShowCard({
  casaId,
  tags,
  perfil,
  jaTocou,
  ultimaApresentacaoStr,
}: {
  casaId: string;
  tags: string[];
  perfil: string | null;
  jaTocou: boolean;
  ultimaApresentacaoStr: string | null;
}) {
  const vazio = tags.length === 0 && !perfil && !jaTocou;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium inline-flex items-center gap-1.5">
          <Building2 className="size-4 text-primary" />
          Sobre a casa
        </p>
        <Link
          href={`/casas/${casaId}`}
          className="text-xs text-primary hover:underline inline-flex items-center"
        >
          Ver casa <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {vazio ? (
        <p className="text-sm text-muted-foreground">
          Sem perfil cadastrado ainda.{" "}
          <Link href={`/casas/${casaId}`} className="text-primary hover:underline">
            Preencher na tela da casa
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            {jaTocou && (
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="size-4" />
                Já tocou aqui
              </span>
            )}
            {ultimaApresentacaoStr && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarCheck className="size-4" />
                Última: {ultimaApresentacaoStr}
              </span>
            )}
          </div>
          {perfil && <p className="text-sm text-muted-foreground">{perfil}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-accent px-2.5 py-1 text-xs text-foreground/80"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
