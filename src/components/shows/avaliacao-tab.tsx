"use client";

import { useActionState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { saveAvaliacaoAction } from "@/app/(app)/shows/[id]/actions-evaluation";
import { toast } from "sonner";
import type { VenueEvaluation } from "@/db/schema";
import { useEffect, useState } from "react";

export function AvaliacaoTab({
  showId,
  avaliacao,
}: {
  showId: string;
  avaliacao: VenueEvaluation | null;
}) {
  const action = saveAvaliacaoAction.bind(null, showId);
  const [state, formAction, pending] = useActionState(action, null);
  const [nota, setNota] = useState<number>(avaliacao?.notaGeral ?? 0);

  useEffect(() => {
    if (state && !state.error && !state.fieldErrors) {
      // success but without redirect; ignore
    }
    if (state && !state.fieldErrors && !state.error && !pending) {
      // intentionally no toast — only feedback below
    }
  }, [state, pending]);

  return (
    <Card>
      <CardContent className="py-6 max-w-2xl">
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label>Nota geral</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNota(n)}
                  className={cn(
                    "transition-colors",
                    n <= nota
                      ? "text-amber-400"
                      : "text-muted-foreground hover:text-amber-400/60"
                  )}
                  title={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                >
                  <Star
                    className={cn("size-6", n <= nota && "fill-current")}
                  />
                </button>
              ))}
              <input type="hidden" name="notaGeral" value={nota || ""} />
              {nota > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {nota} / 5
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tocaria de novo nessa casa?</Label>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tocariaNovamente"
                  value="sim"
                  defaultChecked={avaliacao?.tocariaNovamente === true}
                  className="accent-primary"
                />
                <span className="text-sm">Sim</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer ml-4">
                <input
                  type="radio"
                  name="tocariaNovamente"
                  value="nao"
                  defaultChecked={avaliacao?.tocariaNovamente === false}
                  className="accent-primary"
                />
                <span className="text-sm">Não</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer ml-4">
                <input
                  type="radio"
                  name="tocariaNovamente"
                  value=""
                  defaultChecked={avaliacao?.tocariaNovamente == null}
                  className="accent-primary"
                />
                <span className="text-sm text-muted-foreground">Não opinou</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={4}
              defaultValue={avaliacao?.observacoes ?? ""}
              placeholder="Como foi o público? Som? Hospitalidade? Pagamento ok? Vale a pena voltar?"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            {state && !state.error && !state.fieldErrors && !pending && (
              <p className="text-sm text-emerald-400">Salvo.</p>
            )}
            <Button
              type="submit"
              disabled={pending}
              onClick={() => {
                setTimeout(() => {
                  if (!state?.error) toast.success("Avaliação salva.");
                }, 200);
              }}
            >
              {pending ? "Salvando..." : "Salvar avaliação"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
