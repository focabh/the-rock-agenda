"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { maskPhone } from "@/lib/validators";

export function ResetForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, null);
  const [telefone, setTelefone] = useState("");

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-emerald-400">
          Senha redefinida! Já pode entrar com a nova senha.
        </p>
        <Button className="w-full" render={<Link href="/login" />}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ident">Usuário ou email</Label>
        <Input id="ident" name="ident" autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telefone">Telefone cadastrado</Label>
        <Input
          id="telefone"
          name="telefone"
          inputMode="tel"
          placeholder="(31) 99999-9999"
          value={telefone}
          onChange={(e) => setTelefone(maskPhone(e.target.value))}
          required
        />
        <p className="text-xs text-muted-foreground">
          O mesmo número do seu cadastro — é como confirmamos que é você.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Redefinindo..." : "Redefinir senha"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Lembrou?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
