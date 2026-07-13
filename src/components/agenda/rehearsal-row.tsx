import Link from "next/link";
import { Pencil, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/shared/delete-button";
import { EnsaioStatusBadge } from "@/components/agenda/ensaio-status-badge";
import { deleteRehearsalAction } from "@/app/(app)/agenda/actions";
import { formatDataBR, dataPartesBR } from "@/lib/formatters";
import type { Rehearsal } from "@/db/schema";

/** Linha de ensaio na lista — usada em Próximos e no histórico (Anteriores). */
export function RehearsalRow({ r, admin }: { r: Rehearsal; admin: boolean }) {
  const partes = dataPartesBR(r.data);
  return (
    <li className="flex items-center gap-2 pr-3">
      <Link
        href={`/ensaios/${r.id}`}
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 hover:bg-accent/30"
      >
        <div className="flex flex-col items-center text-center w-12 shrink-0">
          <span className="text-[10px] uppercase text-muted-foreground tracking-widest">
            {partes.mes}
          </span>
          <span className="text-2xl font-bold leading-none">{partes.dia}</span>
          <span className="text-xs text-muted-foreground mt-0.5">{partes.ano}</span>
        </div>
        {/* Conteúdo em 2 níveis pra caber no mobile sem cortar: foco (até 2
            linhas) + status; embaixo horário e local com largura total. */}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium leading-snug line-clamp-3">{r.foco || "Ensaio"}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <EnsaioStatusBadge status={r.status} />
            {r.inicio && (
              <span className="font-mono">
                {r.inicio}
                {r.termino ? `–${r.termino}` : ""}
              </span>
            )}
            {(r.local || r.endereco) && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{r.local || r.endereco}</span>
              </span>
            )}
            {!r.inicio && !r.local && !r.endereco && <span>{formatDataBR(r.data)}</span>}
          </div>
        </div>
      </Link>
      {admin && (
        <>
          <Button
            render={<Link href={`/ensaios/${r.id}/editar`} />}
            variant="ghost"
            size="icon"
            title="Editar"
          >
            <Pencil className="size-4" />
          </Button>
          <DeleteButton action={deleteRehearsalAction.bind(null, r.id)} itemName="Ensaio" />
        </>
      )}
    </li>
  );
}
