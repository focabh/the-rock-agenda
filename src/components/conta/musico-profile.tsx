"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { AvatarUploader } from "@/components/shared/avatar-uploader";
import { Mic } from "lucide-react";
import {
  linkSelfToPositionAction,
  updateMyMemberAction,
} from "@/app/(app)/conta/actions";
import { maskPhone, telefoneValido, pixValido } from "@/lib/validators";
import { toast } from "sonner";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type MusicoProfileMember = {
  id: string;
  nome: string;
  funcao: string;
  telefone: string | null;
  chavePix: string | null;
  avatar: string | null;
  isManager: boolean;
};

export function MusicoProfile({
  member,
  availablePositions,
}: {
  member: MusicoProfileMember | null;
  availablePositions: string[];
}) {
  if (member) return <LinkedView member={member} />;
  return <ClaimView availablePositions={availablePositions} />;
}

function LinkedView({ member }: { member: MusicoProfileMember }) {
  const [state, formAction, pending] = useActionState(updateMyMemberAction, null);
  const [telefone, setTelefone] = useState(member.telefone ?? "");
  const [chavePix, setChavePix] = useState(member.chavePix ?? "");
  const [clientErr, setClientErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state?.success) toast.success("Ficha atualizada.");
  }, [state]);

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
    const p = String(fd.get("chavePix") ?? "");
    if (p && !pixValido(p))
      errs.chavePix = "Chave PIX inválida — CPF, telefone, email ou chave aleatória";
    setClientErr(errs);
    if (Object.keys(errs).length > 0) return;
    formAction(fd);
  }

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
        <form action={handle} className="space-y-4 max-w-md">
          <AvatarUploader initialAvatar={member.avatar} member={member} />
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" defaultValue={member.nome} required />
            <ErrLine name="nome" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
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
            <Label htmlFor="chavePix">Chave PIX</Label>
            <Input
              id="chavePix"
              name="chavePix"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              placeholder="email, telefone ou chave aleatória"
            />
            <ErrLine name="chavePix" />
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
  const [state, formAction, pending] = useActionState(
    linkSelfToPositionAction,
    null
  );
  const [telefone, setTelefone] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [clientErr, setClientErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state?.success) {
      toast.success("Você agora também é músico!");
      router.refresh();
    }
  }, [state, router]);

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
      errs.telefone = "Telefone inválido — use DDD + número";
    const p = String(fd.get("chavePix") ?? "");
    if (p && !pixValido(p)) errs.chavePix = "Chave PIX inválida";
    setClientErr(errs);
    if (Object.keys(errs).length > 0) return;
    formAction(fd);
  }

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
          <form action={handle} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="posicao">Posição na banda</Label>
              <select
                id="posicao"
                name="posicao"
                className={selectCls}
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {availablePositions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ErrLine name="posicao" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome (opcional)</Label>
              <Input
                id="nome"
                name="nome"
                placeholder="Como aparece na banda"
              />
              <ErrLine name="nome" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
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
              <Label htmlFor="chavePix">Chave PIX</Label>
              <Input
                id="chavePix"
                name="chavePix"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                placeholder="email, telefone ou chave aleatória"
              />
              <ErrLine name="chavePix" />
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
