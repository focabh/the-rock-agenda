"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/shared/field-error";
import { registerAction } from "@/app/(auth)/actions";
import { maskCPF, maskPhone } from "@/lib/validators";
import { CheckCircle2 } from "lucide-react";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RegisterForm({
  availablePositions,
}: {
  availablePositions: string[];
}) {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="size-12 text-emerald-400 mx-auto" />
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">Cadastro enviado!</h2>
          <p className="text-sm text-muted-foreground">
            Seu acesso ficará disponível assim que o administrador aprovar.
          </p>
        </div>
        <Button render={<Link href="/login" />} className="w-full">
          Voltar para o login
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" placeholder="João" required />
          <FieldError state={state} name="nome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sobrenome">Sobrenome</Label>
          <Input id="sobrenome" name="sobrenome" placeholder="Silva" required />
          <FieldError state={state} name="sobrenome" />
        </div>
      </div>

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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="voce@email.com"
          required
        />
        <FieldError state={state} name="email" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Usuário</Label>
        <Input
          id="username"
          name="username"
          placeholder="ex: joaosilva"
          autoComplete="off"
          required
        />
        <FieldError state={state} name="username" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="mínimo 6 caracteres"
          autoComplete="new-password"
          required
        />
        <FieldError state={state} name="password" />
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
            required
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
            required
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
          required
        />
        <FieldError state={state} name="chavePix" />
      </div>

      {state?.error && !state.fieldErrors && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Criar cadastro"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
