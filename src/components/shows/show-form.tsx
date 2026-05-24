"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import {
  SHOW_STATUS_OPTIONS,
  PAGAMENTO_STATUS_OPTIONS,
} from "@/components/shared/status-badge";
import type { ActionState } from "@/lib/form";
import type { Show, Venue } from "@/db/schema";

function toDatetimeLocal(d: Date | number | undefined | null): string {
  if (!d) return "";
  const date = typeof d === "number" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ShowForm({
  show,
  casas,
  action,
  submitLabel = "Salvar",
  cancelHref = "/shows",
}: {
  show?: Show;
  casas: Venue[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const cacheReais = show?.cacheCentavos ? show.cacheCentavos / 100 : "";

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="casaId">Casa *</Label>
            <select
              id="casaId"
              name="casaId"
              defaultValue={show?.casaId ?? ""}
              className={selectCls}
              required
            >
              <option value="">Selecione...</option>
              {casas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.bairro && ` — ${c.bairro}`}
                </option>
              ))}
            </select>
            <FieldError state={state} name="casaId" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Data e hora do show *</Label>
            <Input
              id="data"
              name="data"
              type="datetime-local"
              defaultValue={toDatetimeLocal(show?.data)}
              required
            />
            <FieldError state={state} name="data" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <select
              id="status"
              name="status"
              defaultValue={show?.status ?? "planejado"}
              className={selectCls}
              required
            >
              {SHOW_STATUS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <FieldError state={state} name="status" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inicio">Início (HH:mm)</Label>
            <Input
              id="inicio"
              name="inicio"
              type="time"
              defaultValue={show?.inicio ?? ""}
            />
            <FieldError state={state} name="inicio" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="termino">Término (HH:mm)</Label>
            <Input
              id="termino"
              name="termino"
              type="time"
              defaultValue={show?.termino ?? ""}
            />
            <FieldError state={state} name="termino" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passagemSom">Passagem de som</Label>
            <Input
              id="passagemSom"
              name="passagemSom"
              type="time"
              defaultValue={show?.passagemSom ?? ""}
            />
            <FieldError state={state} name="passagemSom" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="publicoEsperado">Público esperado</Label>
            <Input
              id="publicoEsperado"
              name="publicoEsperado"
              type="number"
              min={0}
              defaultValue={show?.publicoEsperado ?? ""}
              placeholder="100"
            />
            <FieldError state={state} name="publicoEsperado" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contatoNome">Contato responsável</Label>
            <Input
              id="contatoNome"
              name="contatoNome"
              defaultValue={show?.contatoNome ?? ""}
            />
            <FieldError state={state} name="contatoNome" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contatoTelefone">Telefone</Label>
            <Input
              id="contatoTelefone"
              name="contatoTelefone"
              defaultValue={show?.contatoTelefone ?? ""}
              placeholder="(31) 99999-9999"
            />
            <FieldError state={state} name="contatoTelefone" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cacheReais">Cachê (R$)</Label>
            <Input
              id="cacheReais"
              name="cacheReais"
              type="number"
              min={0}
              step={0.01}
              defaultValue={cacheReais}
              placeholder="1500"
            />
            <FieldError state={state} name="cacheReais" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pagamentoStatus">Pagamento</Label>
            <select
              id="pagamentoStatus"
              name="pagamentoStatus"
              defaultValue={show?.pagamentoStatus ?? "pendente"}
              className={selectCls}
            >
              {PAGAMENTO_STATUS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <FieldError state={state} name="pagamentoStatus" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={3}
              defaultValue={show?.observacoes ?? ""}
              placeholder="Detalhes do contrato, particularidades da casa, lembretes..."
            />
            <FieldError state={state} name="observacoes" />
          </div>

          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
            {state?.error && !state.fieldErrors && (
              <p className="mr-auto text-sm text-destructive">{state.error}</p>
            )}
            <Button render={<Link href={cancelHref} />} variant="outline">
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
