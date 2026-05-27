"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { changePasswordAction } from "@/app/(app)/conta/actions";
import { toast } from "sonner";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Senha alterada com sucesso.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardContent className="py-6">
        <h3 className="font-semibold mb-1">Trocar senha</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Vale para qualquer usuário, inclusive admin.
        </p>
        <form ref={formRef} action={formAction} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="atual">Senha atual</Label>
            <Input id="atual" name="atual" type="password" autoComplete="current-password" required />
            <FieldError state={state} name="atual" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nova">Nova senha</Label>
            <Input id="nova" name="nova" type="password" autoComplete="new-password" placeholder="mínimo 6 caracteres" required />
            <FieldError state={state} name="nova" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar">Confirmar nova senha</Label>
            <Input id="confirmar" name="confirmar" type="password" autoComplete="new-password" required />
            <FieldError state={state} name="confirmar" />
          </div>
          {state?.error && !state.fieldErrors && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Trocar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
