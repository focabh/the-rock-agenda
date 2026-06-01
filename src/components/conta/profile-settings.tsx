"use client";

import { useActionState, useEffect, useState } from "react";
import { UserCog, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { updateProfileAction } from "@/app/(app)/conta/actions";
import { toast } from "sonner";

export function ProfileSettings({
  username,
  apelido,
  nome,
  sobrenome,
}: {
  username: string;
  apelido: string | null;
  nome: string | null;
  sobrenome: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    null
  );
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success("Perfil atualizado.");
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
            <UserCog className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">Perfil</h3>
            <p className="text-sm text-muted-foreground">
              Como você quer ser chamado no app. O apelido sobrescreve o nome em
              todo lugar (sidebar, ficha de músico, repartição, etc.).
            </p>
          </div>
        </div>

        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="username">Nome de usuário (login)</Label>
            <Input
              id="username"
              name="username"
              defaultValue={username}
              autoCapitalize="none"
              autoComplete="username"
              spellCheck={false}
              maxLength={40}
              required
            />
            <p className="text-xs text-muted-foreground">
              É o que você usa pra entrar. Mín. 3 caracteres, só letras, números, ponto, underline ou hífen.
            </p>
            <FieldError state={state} name="username" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apelido">Como gostaria de ser chamado</Label>
            <Input
              id="apelido"
              name="apelido"
              placeholder="Ex.: Foca"
              defaultValue={apelido ?? ""}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco pra usar o nome completo.
            </p>
            <FieldError state={state} name="apelido" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-nome">Nome *</Label>
              <Input
                id="profile-nome"
                name="nome"
                placeholder="João"
                defaultValue={nome ?? ""}
                required
              />
              <FieldError state={state} name="nome" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-sobrenome">Sobrenome *</Label>
              <Input
                id="profile-sobrenome"
                name="sobrenome"
                placeholder="Silva"
                defaultValue={sobrenome ?? ""}
                required
              />
              <FieldError state={state} name="sobrenome" />
            </div>
          </div>

          {state?.error && !state.fieldErrors && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            {showSaved && (
              <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
                <Check className="size-3.5" /> salvo
              </span>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
