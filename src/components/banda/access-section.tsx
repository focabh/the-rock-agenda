"use client";

import { useActionState, useState, useTransition } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { toast } from "sonner";
import {
  createUserForMemberAction,
  unlinkUserFromMemberAction,
} from "@/app/(app)/banda/[id]/access-actions";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AccessSection({
  memberId,
  linkedUsername,
  linkedRole,
}: {
  memberId: string;
  linkedUsername: string | null;
  linkedRole: string | null;
}) {
  const action = createUserForMemberAction.bind(null, memberId);
  const [state, formAction, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (linkedUsername) {
    return (
      <Card>
        <CardContent className="py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">
              <span className="text-muted-foreground">Acesso vinculado:</span>{" "}
              <span className="font-mono">@{linkedUsername}</span>{" "}
              <span className="text-xs uppercase tracking-wider text-primary ml-2">
                {linkedRole === "admin" ? "Admin" : "Músico"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Pra trocar a senha, remova e crie de novo.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                !confirm(
                  `Remover o acesso de @${linkedUsername}? Ele não conseguirá mais entrar.`
                )
              )
                return;
              startTransition(async () => {
                await unlinkUserFromMemberAction(memberId);
                toast.success("Acesso removido.");
              });
            }}
            className="text-destructive"
          >
            <Trash2 className="size-4" />
            Remover
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <KeyRound className="size-4" />
              Acesso ao sistema
            </p>
            <p className="text-sm text-muted-foreground">
              Crie um login pra esse músico acessar o app.
            </p>
          </div>
          {!open && <Button onClick={() => setOpen(true)}>Criar acesso</Button>}
        </div>

        {open && (
          <form
            action={(fd) => {
              formAction(fd);
              setTimeout(() => {
                if (!state?.error) {
                  toast.success("Acesso criado.");
                  setOpen(false);
                }
              }, 300);
            }}
            className="space-y-3 border-t border-border pt-4"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="ex: vocalista"
                  autoComplete="off"
                  required
                />
                <FieldError state={state} name="username" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha inicial</Label>
                <Input
                  id="password"
                  name="password"
                  type="text"
                  placeholder="mínimo 6 caracteres"
                  autoComplete="off"
                  required
                />
                <FieldError state={state} name="password" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Permissão</Label>
              <select
                id="role"
                name="role"
                defaultValue="membro"
                className={selectCls}
              >
                <option value="membro">Músico (só vê + confirma presença)</option>
                <option value="admin">Admin (gerencia tudo)</option>
              </select>
              <FieldError state={state} name="role" />
            </div>
            {state?.error && !state.fieldErrors && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
