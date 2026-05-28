"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkUsernameAction, registerAction } from "@/app/(auth)/actions";
import { maskPhone, telefoneValido, pixValido } from "@/lib/validators";
import { CheckCircle2, Loader2 } from "lucide-react";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._-]+$/;

type Fields = {
  nome: string;
  sobrenome: string;
  posicao: string;
  email: string;
  username: string;
  password: string;
  telefone: string;
  chavePix: string;
};

export function RegisterForm({
  availablePositions,
}: {
  availablePositions: string[];
}) {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const [fields, setFields] = useState<Fields>({
    nome: "",
    sobrenome: "",
    posicao: "",
    email: "",
    username: "",
    password: "",
    telefone: "",
    chavePix: "",
  });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "ok" | "taken"
  >("idle");
  const [, startCheck] = useTransition();

  function set<K extends keyof Fields>(k: K, v: string) {
    setFields((s) => ({ ...s, [k]: v }));
    if (clientErrors[k]) {
      setClientErrors((e) => {
        const next = { ...e };
        delete next[k];
        return next;
      });
    }
  }

  function err(name: keyof Fields): string | undefined {
    return clientErrors[name] ?? state?.fieldErrors?.[name]?.[0];
  }

  function Err({ name }: { name: keyof Fields }) {
    const m = err(name);
    return m ? <p className="text-sm text-destructive">{m}</p> : null;
  }

  function checkUsername() {
    const u = fields.username.trim().toLowerCase();
    if (u.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(u)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    startCheck(async () => {
      try {
        const r = await checkUsernameAction(u);
        setUsernameStatus(r.taken ? "taken" : "ok");
      } catch {
        setUsernameStatus("idle");
      }
    });
  }

  function handle() {
    const errs: Record<string, string> = {};
    if (!fields.nome.trim()) errs.nome = "Informe seu nome";
    if (!fields.sobrenome.trim()) errs.sobrenome = "Informe seu sobrenome";
    if (!fields.posicao) errs.posicao = "Escolha sua posição na banda";
    if (!EMAIL_RE.test(fields.email))
      errs.email = "Email inválido — ex: nome@email.com";
    const u = fields.username.trim().toLowerCase();
    if (u.length < 3) errs.username = "Use pelo menos 3 caracteres";
    else if (!USERNAME_RE.test(u))
      errs.username =
        "Use só letras minúsculas, números, ponto, underline ou hífen";
    else if (usernameStatus === "taken")
      errs.username = "Esse usuário já existe — escolha outro";
    if (!fields.password || fields.password.length < 6)
      errs.password = "A senha precisa ter ao menos 6 caracteres";
    if (!telefoneValido(fields.telefone))
      errs.telefone = "Telefone inválido — use DDD + número, ex: (31) 99999-9999";
    if (!pixValido(fields.chavePix))
      errs.chavePix =
        "Chave PIX inválida — pode ser CPF, telefone, email ou chave aleatória";

    setClientErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Monta o FormData a partir do estado (preserva valores no re-render).
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
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

  const hasGlobalError = Boolean(
    state?.error && !state.fieldErrors
  );
  const hasFieldErrors =
    Object.keys(clientErrors).length > 0 ||
    Boolean(state?.fieldErrors && Object.keys(state.fieldErrors).length > 0);

  return (
    <form
      action={handle}
      className="space-y-4"
      noValidate
      autoComplete="on"
    >
      <p className="text-xs text-muted-foreground">
        Todos os campos são obrigatórios.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            name="nome"
            placeholder="João"
            value={fields.nome}
            onChange={(e) => set("nome", e.target.value)}
            autoComplete="given-name"
          />
          <Err name="nome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sobrenome">Sobrenome *</Label>
          <Input
            id="sobrenome"
            name="sobrenome"
            placeholder="Silva"
            value={fields.sobrenome}
            onChange={(e) => set("sobrenome", e.target.value)}
            autoComplete="family-name"
          />
          <Err name="sobrenome" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="posicao">Posição na banda *</Label>
        <select
          id="posicao"
          name="posicao"
          className={selectCls}
          value={fields.posicao}
          onChange={(e) => set("posicao", e.target.value)}
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
        <Err name="posicao" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          placeholder="voce@email.com"
          value={fields.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="email"
        />
        <Err name="email" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username" className="flex items-center gap-2">
          Usuário *
          {usernameStatus === "checking" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> verificando…
            </span>
          )}
          {usernameStatus === "ok" && (
            <span className="text-xs text-emerald-400">disponível ✓</span>
          )}
          {usernameStatus === "taken" && (
            <span className="text-xs text-destructive">já existe</span>
          )}
        </Label>
        <Input
          id="username"
          name="username"
          placeholder="ex: joaosilva"
          value={fields.username}
          onChange={(e) => set("username", e.target.value.toLowerCase())}
          onBlur={checkUsername}
          autoComplete="username"
        />
        <Err name="username" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha *</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="mínimo 6 caracteres"
          value={fields.password}
          onChange={(e) => set("password", e.target.value)}
          autoComplete="new-password"
        />
        <Err name="password" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefone">Telefone *</Label>
        <Input
          id="telefone"
          name="telefone"
          type="tel"
          inputMode="tel"
          placeholder="(31) 99999-9999"
          value={fields.telefone}
          onChange={(e) => set("telefone", maskPhone(e.target.value))}
          autoComplete="tel"
        />
        <Err name="telefone" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="chavePix">Chave PIX (para receber pagamentos) *</Label>
        <Input
          id="chavePix"
          name="chavePix"
          placeholder="CPF, telefone, email ou chave aleatória"
          value={fields.chavePix}
          onChange={(e) => set("chavePix", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Usamos pra te repassar o cachê dos shows.
        </p>
        <Err name="chavePix" />
      </div>

      {hasGlobalError && (
        <p className="text-sm text-destructive">{state?.error}</p>
      )}
      {hasFieldErrors && !hasGlobalError && (
        <p className="text-xs text-muted-foreground">
          Confira os campos marcados em vermelho.
        </p>
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
