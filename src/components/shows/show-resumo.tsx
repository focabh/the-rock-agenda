import Link from "next/link";
import {
  Pencil,
  MapPin,
  Phone,
  Clock,
  Users,
  Volume2,
  AlertTriangle,
  Timer,
  Beer,
  UserPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/shared/delete-button";
import {
  ShowStatusBadge,
  PagamentoStatusBadge,
} from "@/components/shared/status-badge";
import { formatBRL, formatDataExtensa, formatHoraBR } from "@/lib/formatters";
import { deleteShowAction } from "@/app/(app)/shows/actions";
import type { Show, Venue, Member } from "@/db/schema";

export function ShowResumo({
  show,
  casa,
  conflitos = [],
  admin = false,
  gastosCentavos = 0,
}: {
  show: Show;
  casa: Venue;
  conflitos?: Member[];
  admin?: boolean;
  gastosCentavos?: number;
}) {
  return (
    <div className="space-y-4">
      {conflitos.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-200">
                Conflito de disponibilidade
              </p>
              <p className="text-amber-100/80 mt-0.5">
                Nesta data{" "}
                <strong>
                  {conflitos.map((m) => m.nome).join(", ")}
                </strong>{" "}
                {conflitos.length === 1
                  ? "está indisponível"
                  : "estão indisponíveis"}
                . Veja em{" "}
                <Link
                  href={`/banda/${conflitos[0].id}`}
                  className="text-amber-200 underline hover:text-amber-100"
                >
                  Banda
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid md:grid-cols-3 gap-4">
      <Card className="md:col-span-2">
        <CardContent className="py-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
                {casa.nome}
                {show.privado && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
                    Particular
                  </span>
                )}
              </h2>
              {(casa.bairro || casa.cidade) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="size-3.5" />
                  {[casa.endereco, casa.bairro, casa.cidade]
                    .filter(Boolean)
                    .join(" — ")}
                </p>
              )}
            </div>
            {admin && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/shows/${show.id}/editar`} />}
                >
                  <Pencil className="size-4" />
                  Editar
                </Button>
                <DeleteButton
                  itemName="show"
                  action={deleteShowAction.bind(null, show.id)}
                />
              </div>
            )}
          </div>

          <p className="text-base font-medium first-letter:uppercase">
            {formatDataExtensa(show.data)}
          </p>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <p className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Início:</span>
              <span className="font-mono">{formatHoraBR(show.data)}</span>
              {show.termino && (
                <>
                  <span className="text-muted-foreground">— Fim:</span>
                  <span className="font-mono">{show.termino}</span>
                </>
              )}
            </p>
            {show.passagemSom && (
              <p className="flex items-center gap-2">
                <Volume2 className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Passagem:</span>
                <span className="font-mono">{show.passagemSom}</span>
              </p>
            )}
            {show.duracaoMin != null && show.duracaoMin > 0 && (
              <p className="flex items-center gap-2">
                <Timer className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Duração:</span>
                <span>{show.duracaoMin} min</span>
              </p>
            )}
            {show.publicoEsperado != null && show.publicoEsperado > 0 && (
              <p className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Público esperado:</span>
                <span>{show.publicoEsperado}</span>
              </p>
            )}
            {show.consumacao && (
              <p className="flex items-center gap-2">
                <Beer className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Consumação:</span>
                <span>{show.consumacao}</span>
              </p>
            )}
            {show.acompanhantes && (
              <p className="flex items-center gap-2">
                <UserPlus className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Acompanhantes:</span>
                <span>{show.acompanhantes}</span>
              </p>
            )}
            {show.contatoNome && (
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                <span>{show.contatoNome}</span>
                {show.contatoTelefone && (
                  <span className="text-muted-foreground">
                    — {show.contatoTelefone}
                  </span>
                )}
              </p>
            )}
          </div>

          {show.observacoes && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Observações
              </p>
              <p className="text-sm whitespace-pre-wrap">{show.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="py-5 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Status
            </p>
            <ShowStatusBadge status={show.status} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Cachê
            </p>
            <p className="font-mono text-2xl font-semibold text-amber-400">
              {show.cacheCentavos != null && show.cacheCentavos > 0
                ? formatBRL(show.cacheCentavos)
                : "—"}
            </p>
            <PagamentoStatusBadge status={show.pagamentoStatus} />
            {gastosCentavos > 0 && (show.cacheCentavos ?? 0) > 0 && (
              <div className="pt-2 mt-1 border-t border-border space-y-1 text-sm">
                <p className="flex items-center justify-between text-muted-foreground">
                  <span>Gastos do show</span>
                  <span className="font-mono">− {formatBRL(gastosCentavos)}</span>
                </p>
                <p className="flex items-center justify-between font-medium">
                  <span>Lucro líquido</span>
                  <span className="font-mono text-amber-400">
                    {formatBRL((show.cacheCentavos ?? 0) - gastosCentavos)}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
