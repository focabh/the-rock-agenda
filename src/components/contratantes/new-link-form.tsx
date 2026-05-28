"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Share2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createContractorLinkAction } from "@/app/(app)/contratantes/actions";

const PRESETS = [
  { days: 7, label: "7 dias" },
  { days: 10, label: "10 dias (padrão)" },
  { days: 30, label: "30 dias" },
];

export function NewContractorLinkForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(10);
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      const r = await createContractorLinkAction({
        label: label || undefined,
        days,
      });
      if (r?.ok && r.token) {
        const url = `${window.location.origin}/c/${r.token}`;
        setCreated(url);
        toast.success("Link criado!");
      }
    });
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui copiar — copie manualmente.");
    }
  }

  if (created) {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/30 shrink-0">
              <CheckCircle2 className="size-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">Link pronto pra compartilhar</h3>
              <p className="text-sm text-muted-foreground">
                Manda esse link pro contratante por WhatsApp ou onde preferir.
                Funciona sem login.
              </p>
            </div>
          </div>
          <code className="block text-xs px-3 py-2 rounded bg-muted/40 text-muted-foreground break-all">
            {created}
          </code>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={copy}>
              <Copy className="size-4" /> Copiar link
            </Button>
            <Button
              variant="outline"
              render={
                <a href={created} target="_blank" rel="noopener noreferrer" />
              }
            >
              <Share2 className="size-4" /> Abrir
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Oi! Aqui está o material da The Rock: ${created}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline ml-1"
            >
              Mandar pelo WhatsApp →
            </a>
            <div className="flex-1" />
            <Button
              variant="ghost"
              onClick={() => router.push("/contratantes")}
            >
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="label">Rótulo (opcional)</Label>
          <Input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Bar do Zé — orçamento jun/2026"
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground">
            Aparece só pra você, na lista. O contratante nunca vê.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Validade</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setDays(p.days)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  days === p.days
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/30"
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm">
              <span className="text-muted-foreground text-xs">Outro:</span>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) =>
                  setDays(
                    Math.max(1, Math.min(365, Number(e.target.value) || 10))
                  )
                }
                className="w-14 bg-transparent text-sm focus:outline-none"
              />
              <span className="text-muted-foreground text-xs">dias</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => router.push("/contratantes")}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Gerando..." : "Gerar link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
