"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/app/(auth)/actions";
import { maskPhone, telefoneValido } from "@/lib/validators";
import { CheckCircle2 } from "lucide-react";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterForm({
  availablePositions,
}: {
  availablePositions: string[];
}) {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const [telefone, setTelefone] = useState("");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  function err(name: string): string | undefined {
    return clientErrors[name] ?? state?.fieldErrors?.[name]?.[0];
  }

  function Err({ name }: { name: string }) {
    const m = err(name);
    return m ? <p className="text-sm text-destructive">{m}</p> : null;
  }

  // Valida no cliente antes de enviar (email + telefone), além da validação no servidor.
  function handle(fd: FormData) {
    const errs: Record<string, string> = {};
    const email = String(fd.get("email") ?? "").trim();
    if (!EMAIL_RE.test(email)) errs.email = "Email inválido (ex: nome@email.com)";
    const tel = String(fd.get("telefone") ?? "");
    if (!telefoneValido(tel))
      errs.telefone = "Telefone inválido — use DDD + número, ex: (31) 99999-9999";
    setClientErrors(errs);
    if (Object.keys(errs).length > 0) return;
    formAction(fd);
  }

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
    <form action={handle} className="space-y-4" noValidate>
      <p className="text-xs text-muted-foreground">
        Todos os campos são obrigatórios.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" placeholder="João" required />
          <Err name="nome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sobrenome">Sobrenome</Label>
          <Input id="sobrenome" name="sobrenome" placeholder="Silva" required />
          <Err name="sobrenome" />
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
        <Err name="posicao" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          placeholder="voce@email.com"
          required
        />
        <Err name="email" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Usuário</Label>
        <Input id="username" name="username" placeholder="ex: joaosilva" autoComplete="off" required />
        <Err name="username" />
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
        <Err name="password" />
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
          required
        />
        <Err name="telefone" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="chavePix">Chave PIX (para receber pagamentos) *</Label>
        <Input
          id="chavePix"
          name="chavePix"
          placeholder="CPF, telefone, email ou chave aleatória"
          required
        />
        <p className="text-xs text-muted-foreground">
          Usamos pra te repassar o cachê dos shows.
        </p>
        <Err name="chavePix" />
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
