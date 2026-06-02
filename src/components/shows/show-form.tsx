"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/shared/number-stepper";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import {
  SHOW_STATUS_OPTIONS,
  PAGAMENTO_STATUS_OPTIONS,
} from "@/components/shared/status-badge";
import type { ActionState } from "@/lib/form";
import type { Show, Venue } from "@/db/schema";
import { toBRDatetimeLocal } from "@/lib/formatters";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ShowForm({
  show,
  casas,
  action,
  submitLabel = "Salvar",
  cancelHref = "/shows",
  defaultDate,
}: {
  show?: Show;
  casas: Venue[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  cancelHref?: string;
  defaultDate?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [duracao, setDuracao] = useState(show?.duracaoMin ?? 60);
  const cacheReais = show?.cacheCentavos ? show.cacheCentavos / 100 : "";
  const dataDefault = show?.data
    ? toBRDatetimeLocal(show.data)
    : defaultDate
      ? `${defaultDate}T20:00`
      : "";

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

          <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
            <input
              type="checkbox"
              name="privado"
              defaultChecked={show?.privado ?? false}
              className="mt-0.5 size-4 accent-red-600"
            />
            <span className="text-sm">
              <span className="font-medium">Evento particular</span> (festa privada)
              <span className="block text-xs text-muted-foreground">
                Não expõe o @ da casa no flyer e trata as infos de forma mais discreta.
              </span>
            </span>
          </label>

          <div className="sm:col-span-2">
            <AddressAutocomplete
              label="Endereço do show (opcional — sobrepõe o da casa)"
              defaultValue={show?.endereco ?? ""}
              defaults={{
                cidade: show?.cidade ?? "",
                estado: show?.estado ?? "",
                lat: show?.latitude?.toString() ?? "",
                lon: show?.longitude?.toString() ?? "",
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Início — data e hora *</Label>
            <Input
              id="data"
              name="data"
              type="datetime-local"
              defaultValue={dataDefault}
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
            <Label htmlFor="duracaoMin">Duração do show</Label>
            <div className="flex items-center gap-2">
              <NumberStepper
                id="duracaoMin"
                name="duracaoMin"
                value={duracao}
                onChange={setDuracao}
                min={0}
                max={600}
                step={15}
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
            <FieldError state={state} name="duracaoMin" />
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

          <div className="space-y-2">
            <Label htmlFor="consumacao">Consumação / couvert</Label>
            <Input
              id="consumacao"
              name="consumacao"
              defaultValue={show?.consumacao ?? ""}
              placeholder="Ex.: couvert R$20, consumação mín. R$30"
            />
            <FieldError state={state} name="consumacao" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acompanhantes">Acompanhantes</Label>
            <Input
              id="acompanhantes"
              name="acompanhantes"
              defaultValue={show?.acompanhantes ?? ""}
              placeholder="Ex.: 2 por integrante na lista"
            />
            <FieldError state={state} name="acompanhantes" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valorIngresso">Valor do ingresso</Label>
            <Input
              id="valorIngresso"
              name="valorIngresso"
              defaultValue={show?.valorIngresso ?? ""}
              placeholder="Ex.: R$ 20 (ou Gratuito)"
            />
            <FieldError state={state} name="valorIngresso" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkVendas">Link de venda de ingressos</Label>
            <Input
              id="linkVendas"
              name="linkVendas"
              defaultValue={show?.linkVendas ?? ""}
              placeholder="https://… (vira QR Code no flyer)"
            />
            <FieldError state={state} name="linkVendas" />
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
