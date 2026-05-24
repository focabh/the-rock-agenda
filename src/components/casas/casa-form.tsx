"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import type { ActionState } from "@/lib/form";
import type { Venue } from "@/db/schema";

type Props = {
  casa?: Venue;
  action: (
    prev: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  submitLabel?: string;
};

export function CasaForm({ casa, action, submitLabel = "Salvar" }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nome">Nome da casa *</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={casa?.nome ?? ""}
              required
              autoFocus
            />
            <FieldError state={state} name="nome" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              name="cidade"
              defaultValue={casa?.cidade ?? ""}
              placeholder="Belo Horizonte"
            />
            <FieldError state={state} name="cidade" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input id="bairro" name="bairro" defaultValue={casa?.bairro ?? ""} />
            <FieldError state={state} name="bairro" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              name="endereco"
              defaultValue={casa?.endereco ?? ""}
            />
            <FieldError state={state} name="endereco" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contatoPrincipal">Contato</Label>
            <Input
              id="contatoPrincipal"
              name="contatoPrincipal"
              defaultValue={casa?.contatoPrincipal ?? ""}
              placeholder="Nome do responsável"
            />
            <FieldError state={state} name="contatoPrincipal" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone / WhatsApp</Label>
            <Input
              id="telefone"
              name="telefone"
              defaultValue={casa?.telefone ?? ""}
              placeholder="(31) 99999-9999"
            />
            <FieldError state={state} name="telefone" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={3}
              defaultValue={casa?.observacoes ?? ""}
              placeholder="Particularidades da casa, melhores horários, dicas..."
            />
            <FieldError state={state} name="observacoes" />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2">
            {state?.error && !state.fieldErrors && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="ml-auto flex gap-2">
              <Button render={<Link href="/casas" />} variant="outline">
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
