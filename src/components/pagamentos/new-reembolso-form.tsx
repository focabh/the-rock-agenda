"use client";

import { useActionState, useState } from "react";
import { Paperclip, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/shared/field-error";
import { toast } from "sonner";
import { fileToDataUrl } from "@/lib/upload-helpers";
import { createReembolsoAction } from "@/app/(app)/pagamentos/actions";
import { toBRDatetimeLocal } from "@/lib/formatters";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewReembolsoForm({
  musicos,
  gastos,
}: {
  musicos: { id: string; label: string }[];
  gastos: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createReembolsoAction,
    null
  );
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDataUrl(file);
      setDataUrl(url);
      setFileName(file.name);
    } catch {
      toast.error("Não consegui ler o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  const isPdf = dataUrl?.startsWith("data:application/pdf");
  const nowDefault = toBRDatetimeLocal(new Date());

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="memberId">Músico *</Label>
              <select
                id="memberId"
                name="memberId"
                defaultValue=""
                className={selectCls}
                required
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {musicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="memberId" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gastoId">Gasto relacionado (opcional)</Label>
              <select
                id="gastoId"
                name="gastoId"
                defaultValue=""
                className={selectCls}
              >
                <option value="">Nenhum</option>
                {gastos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="gastoId" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              name="descricao"
              placeholder="Ex.: Reembolso da gasolina pra ir ao Vila Rock"
              required
            />
            <FieldError state={state} name="descricao" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valorReais">Valor (R$) *</Label>
              <Input
                id="valorReais"
                name="valorReais"
                type="number"
                min={0}
                step={0.01}
                required
                className="font-mono"
              />
              <FieldError state={state} name="valorReais" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paidEm">Pago em *</Label>
              <Input
                id="paidEm"
                name="paidEm"
                type="datetime-local"
                defaultValue={nowDefault}
                required
              />
              <FieldError state={state} name="paidEm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Comprovante PIX *</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground hover:bg-muted/40">
              <Paperclip className="size-4" />
              {busy ? "Processando..." : "Escolher arquivo (imagem ou PDF)"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={onPick}
              />
            </label>
            {dataUrl &&
              (isPdf ? (
                <p className="text-sm text-emerald-300 flex items-center gap-1.5">
                  <Check className="size-4" /> {fileName || "PDF anexado"}
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataUrl}
                  alt="Comprovante"
                  className="max-h-48 w-full rounded-md object-contain border border-border"
                />
              ))}
            <input type="hidden" name="comprovante" value={dataUrl ?? ""} />
            <FieldError state={state} name="comprovante" />
          </div>

          {state?.error && !state.fieldErrors && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending}>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/pagamentos">Cancelar</a>
            </Button>
            <Button type="submit" disabled={pending || !dataUrl || busy}>
              {pending ? "Salvando..." : "Registrar reembolso"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
