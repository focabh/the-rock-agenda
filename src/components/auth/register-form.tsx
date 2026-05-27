"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/shared/field-error";
import { registerAction } from "@/app/(auth)/actions";
import { CheckCircle2 } from "lucide-react";

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const [telefone, setTelefone] = useState("");

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="size-12 text-emerald-400 mx-auto" />
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">Cadastro enviado!</h2>
          <p className="text-sm text-muted-foreground">
            Seu acesso ficará disponível assim que o administrador aprovar. Você
            será avisado.
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
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" placeholder="Seu nome" required />
        <FieldError state={state} name="nome" />
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
          placeholder="ex: foca"
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
        <Label htmlFor="chavePix">Chave PIX</Label>
        <Input
          id="chavePix"
          name="chavePix"
          placeholder="email, telefone, CPF ou chave aleatória"
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
