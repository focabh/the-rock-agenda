"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-background">
      {/* Foto da banda como hero de fundo */}
      <Image
        src="/the-rock-band.jpeg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_25%] opacity-55"
      />
      {/* Vinheta — escurece bordas e topo/base pra dar leitura ao card */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      <div className="absolute inset-0 bg-radial-[ellipse_at_center] from-transparent to-background/60" />

      <Card className="relative w-full max-w-sm border-border/60 bg-card/85 backdrop-blur-md shadow-2xl shadow-primary/10 ring-1 ring-primary/10">
        <CardHeader className="space-y-3 text-center">
          <div className="relative mx-auto size-20 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A]">
            <Image
              src="/the-rock-logo.png"
              alt="The Rock"
              fill
              sizes="80px"
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-xl">The Rock — Operações</CardTitle>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Acesso interno
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Não tem conta?{" "}
              <Link href="/cadastro" className="text-primary hover:underline">
                Criar cadastro
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
