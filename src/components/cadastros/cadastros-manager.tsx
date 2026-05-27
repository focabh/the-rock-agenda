"use client";

import { useState, useTransition } from "react";
import { Check, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import {
  approveUserAction,
  rejectUserAction,
  toggleRegistrationsAction,
} from "@/app/(app)/cadastros/actions";
import type { User } from "@/db/schema";

type Pending = Pick<
  User,
  "id" | "nome" | "username" | "email" | "telefone" | "chavePix"
>;

export function CadastrosManager({
  allowRegistrations,
  pending,
}: {
  allowRegistrations: boolean;
  pending: Pending[];
}) {
  const [allowed, setAllowed] = useState(allowRegistrations);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !allowed;
    setAllowed(next);
    startTransition(async () => {
      await toggleRegistrationsAction(next);
      toast.success(next ? "Cadastros liberados." : "Cadastros fechados.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Permitir novos cadastros</h3>
            <p className="text-sm text-muted-foreground">
              Quando ligado, qualquer pessoa pode se cadastrar pela tela de
              login (entra como pendente até você aprovar).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowed}
            onClick={toggle}
            className={
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
              (allowed ? "bg-primary" : "bg-muted")
            }
          >
            <span
              className={
                "inline-block size-4 transform rounded-full bg-white transition-transform " +
                (allowed ? "translate-x-6" : "translate-x-1")
              }
            />
          </button>
        </CardContent>
      </Card>

      <div>
        <h3 className="font-semibold mb-3">
          Cadastros pendentes{" "}
          {pending.length > 0 && (
            <span className="text-sm text-amber-400">({pending.length})</span>
          )}
        </h3>
        {pending.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Nenhum cadastro pendente"
            description="Quando alguém se cadastrar, aparece aqui para você aprovar."
          />
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {pending.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {u.nome ?? u.username}{" "}
                    <span className="text-xs text-muted-foreground font-mono">
                      @{u.username}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[u.email, u.telefone, u.chavePix && `PIX: ${u.chavePix}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-400"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await approveUserAction(u.id);
                      if (r?.error) toast.error(r.error);
                      else toast.success(`${u.nome ?? u.username} aprovado.`);
                    })
                  }
                >
                  <Check className="size-4" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (!confirm(`Recusar o cadastro de ${u.nome ?? u.username}?`))
                      return;
                    startTransition(async () => {
                      await rejectUserAction(u.id);
                      toast.success("Cadastro recusado.");
                    });
                  }}
                >
                  <X className="size-4" />
                  Recusar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
