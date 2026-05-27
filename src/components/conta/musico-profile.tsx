"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { Mic } from "lucide-react";
import {
  linkSelfToPositionAction,
  updateMyMemberAction,
} from "@/app/(app)/conta/actions";
import { maskCPF, maskPhone } from "@/lib/validators";
import { toast } from "sonner";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Member = {
  nome: string;
  funcao: string;
  telefone: string | null;
  cpf: string | null;
  chavePix: string | null;
};

export function MusicoProfile({
  member,
  availablePositions,
}: {
  member: Member | null;
  availablePositions: string[];
}) {
  if (member) return <LinkedView member={member} />;
  return <ClaimView availablePositions={availablePositions} />;
}

function LinkedView({ member }: { member: Member }) {
  const [state, formAction, pending] = useActionState(updateMyMemberAction, null);
  const [telefone, setTelefone] = useState(member.telefone ?? "");
  const [cpf, setCpf] = useState(member.cpf ?? "");

  useEffect(() => {
    if (state?.success) toast.success("Ficha atualizada.");
  }, [state]);

  return (
    <Card>
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mic className="size-4 text-primary" />
          <h3 className="font-semibold">
            Minha ficha de músico ·{" "}
            <span className="text-primary">{member.funcao}</span>
          </h3>
        </div>
        <form action={formAction} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" defaultValue={member.nome} required />
            <FieldError state={state} name="nome" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                name="telefone"
                inputMode="numeric"
                placeholder="(31) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
              />
              <FieldError state={state} name="telefone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                name="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
              />
              <FieldError state={state} name="cpf" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chavePix">Chave PIX</Label>
            <Input
              id="chavePix"
              name="chavePix"
              defaultValue={member.chavePix ?? ""}
              placeholder="email, CPF, telefone ou chave aleatória"
            />
            <FieldError state={state} name="chavePix" />
          </div>
          {state?.error && !state.fieldErrors && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar ficha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ClaimView({ availablePositions }: { availablePositions: string[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(linkSelfToPositionAction, null);
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    if (state?.success) {
      toast.success("Você agora também é músico!");
      router.refresh();
    }
  }, [state, router]);

  return (
    <Card>
      <CardContent className="py-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Mic className="size-4 text-primary" />
            Virar músico também
          </h3>
          <p className="text-sm text-muted-foreground">
            Vincule seu acesso a uma posição da banda. Você continua admin e
            passa a contar como músico (presença, repertório, divisão do cachê).
          </p>
        </div>
        {availablePositions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todas as posições já têm músico vinculado.
          </p>
        ) : (
          <form action={formAction} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="posicao">Posição na banda</Label>
              <select id="posicao" name="posicao" className={selectCls} required defaultValue="">
                <option value="" disabled>
                  Selecione...
                </option>
                {availablePositions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="posicao" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome (opcional)</Label>
              <Input id="nome" name="nome" placeholder="Como aparece na banda" />
              <FieldError state={state} name="nome" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  name="telefone"
                  inputMode="numeric"
                  placeholder="(31) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                />
                <FieldError state={state} name="telefone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                />
                <FieldError state={state} name="cpf" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chavePix">Chave PIX</Label>
              <Input
                id="chavePix"
                name="chavePix"
                placeholder="email, CPF, telefone ou chave aleatória"
              />
              <FieldError state={state} name="chavePix" />
            </div>
            {state?.error && !state.fieldErrors && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Vinculando..." : "Virar músico"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
