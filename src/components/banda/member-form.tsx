"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { AvatarUploader } from "@/components/shared/avatar-uploader";
import type { ActionState } from "@/lib/form";
import type { Member } from "@/db/schema";
import { maskPhone, telefoneValido } from "@/lib/validators";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MemberForm({
  member,
  action,
  submitLabel = "Salvar",
  positions = [],
}: {
  member?: Member;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  positions?: string[];
}) {
  // Preserva uma função custom/legada que não esteja mais na lista de posições.
  const funcaoOptions =
    member?.funcao && !positions.includes(member.funcao)
      ? [member.funcao, ...positions]
      : positions;
  const [state, formAction, pending] = useActionState(action, null);
  const [isManager, setIsManager] = useState(member?.isManager ?? false);
  const [pct, setPct] = useState<string>(
    member?.percentualDivisao != null ? String(member.percentualDivisao) : ""
  );
  const [fixo, setFixo] = useState<string>(
    member?.pagamentoFixoCentavos != null ? String(member.pagamentoFixoCentavos / 100) : ""
  );
  const [telefone, setTelefone] = useState(member?.telefone ?? "");
  const [clientErr, setClientErr] = useState<Record<string, string>>({});

  function onManagerToggle(checked: boolean) {
    setIsManager(checked);
    if (checked && (pct === "" || pct === "0")) setPct("10");
  }

  function err(name: string) {
    return clientErr[name] ?? state?.fieldErrors?.[name]?.[0];
  }
  function ErrLine({ name }: { name: string }) {
    const m = err(name);
    return m ? <p className="text-sm text-destructive">{m}</p> : null;
  }

  function handle(fd: FormData) {
    const errs: Record<string, string> = {};
    const t = String(fd.get("telefone") ?? "");
    if (t && !telefoneValido(t))
      errs.telefone = "Telefone inválido — use DDD + número, ex: (31) 99999-9999";
    setClientErr(errs);
    if (Object.keys(errs).length > 0) return;
    formAction(fd);
  }

  // Avatar precisa de um "member-like" pra o fallback (mesmo ao criar).
  const avatarMember = {
    id: member?.id ?? "novo",
    nome: member?.nome ?? "Novo músico",
    funcao: member?.funcao ?? "—",
    isManager: member?.isManager ?? false,
  };

  return (
    <Card>
      <CardContent className="py-6">
        <form action={handle} className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <AvatarUploader
              initialAvatar={member?.avatar ?? null}
              member={avatarMember}
            />
            <ErrLine name="avatar" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={member?.nome ?? ""}
              required
            />
            <ErrLine name="nome" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="funcao">Função *</Label>
            <select
              id="funcao"
              name="funcao"
              className={selectCls}
              defaultValue={member?.funcao ?? ""}
              required
            >
              <option value="" disabled>
                Selecione...
              </option>
              {funcaoOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Gerencie as opções em{" "}
              <Link href="/posicoes" className="underline hover:text-foreground">
                Posições
              </Link>
              .
            </p>
            <ErrLine name="funcao" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone / WhatsApp</Label>
            <Input
              id="telefone"
              name="telefone"
              type="tel"
              inputMode="tel"
              placeholder="(31) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(maskPhone(e.target.value))}
            />
            <ErrLine name="telefone" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="percentualDivisao">
              {isManager ? "Comissão (%)" : "Divisão do cachê (%)"}
            </Label>
            <Input
              id="percentualDivisao"
              name="percentualDivisao"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder={isManager ? "10" : "25"}
            />
            <FieldError state={state} name="percentualDivisao" />
          </div>

          {!isManager && (
            <div className="space-y-2">
              <Label htmlFor="pagamentoFixo">Valor fixo por show (R$)</Label>
              <Input
                id="pagamentoFixo"
                name="pagamentoFixo"
                type="number"
                min={0}
                step={0.01}
                value={fixo}
                onChange={(e) => setFixo(e.target.value)}
                placeholder="opcional"
              />
              <p className="text-xs text-muted-foreground">
                Pagamento padrão deste músico em cada show. Se preenchido, vence o %.
                Vazio = usa o % acima; ambos vazios = divisão igualitária. Dá pra
                ajustar em cada show.
              </p>
              <FieldError state={state} name="pagamentoFixo" />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isManager"
                checked={isManager}
                onChange={(e) => onManagerToggle(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="text-sm">
                É <strong>manager</strong> (recebe comissão, não confirma presença em show)
              </span>
            </label>
          </div>


          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="disponibilidade">Disponibilidade</Label>
            <Textarea
              id="disponibilidade"
              name="disponibilidade"
              rows={2}
              defaultValue={member?.disponibilidade ?? ""}
              placeholder="Disponível fins de semana, quartas a noite..."
            />
            <FieldError state={state} name="disponibilidade" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              defaultValue={member?.observacoes ?? ""}
            />
            <FieldError state={state} name="observacoes" />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2">
            {state?.error && !state.fieldErrors && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="ml-auto flex gap-2">
              <Button render={<Link href="/banda" />} variant="outline">
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
