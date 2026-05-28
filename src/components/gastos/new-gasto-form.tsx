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
import { createGastoAction } from "@/app/(app)/gastos/actions";
import { toBRDatetimeLocal } from "@/lib/formatters";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewGastoForm({
  shows,
}: {
  shows: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(createGastoAction, null);
  const [tipo, setTipo] = useState<"show" | "extra">("show");
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
          <div className="space-y-1.5">
            <Label>Tipo do gasto *</Label>
            <div className="grid grid-cols-2 gap-2">
              <RadioPill
                name="tipo"
                value="show"
                label="Ligado a um show"
                checked={tipo === "show"}
                onChange={() => setTipo("show")}
              />
              <RadioPill
                name="tipo"
                value="extra"
                label="Extra (equipamento, etc.)"
                checked={tipo === "extra"}
                onChange={() => setTipo("extra")}
              />
            </div>
            <FieldError state={state} name="tipo" />
          </div>

          {tipo === "show" && (
            <div className="space-y-1.5">
              <Label htmlFor="showId">Show *</Label>
              <select
                id="showId"
                name="showId"
                className={selectCls}
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {shows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="showId" />
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                name="descricao"
                placeholder={
                  tipo === "show"
                    ? "Locação de PA para o show"
                    : "Compra de pedal / aluguel de van / impressão de banner"
                }
                required
              />
              <FieldError state={state} name="descricao" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipient">Para quem *</Label>
              <Input
                id="recipient"
                name="recipient"
                placeholder="Nome / loja / fornecedor"
                required
              />
              <FieldError state={state} name="recipient" />
            </div>
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
              <a href="/gastos">Cancelar</a>
            </Button>
            <Button type="submit" disabled={pending || !dataUrl || busy}>
              {pending ? "Salvando..." : "Registrar gasto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RadioPill({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={
        "cursor-pointer rounded-md border px-3 py-2 text-sm text-center transition-colors " +
        (checked
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent/30")
      }
    >
      <input
        type="radio"
        name={name}
        value={value}
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  );
}
