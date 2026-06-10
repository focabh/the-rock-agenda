"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, ClipboardPaste, Loader2, Sparkles, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { parseBRLToCentavos } from "@/lib/formatters";
import { toast } from "sonner";
import {
  analyzeFinancialAction,
  importGastosAction,
} from "@/app/(app)/gastos/import-actions";
import type { MappedGasto } from "@/lib/financial-import";

function centavosToInput(c: number): string {
  return (c / 100).toFixed(2).replace(".", ",");
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function FinancialImporter() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<MappedGasto[] | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [importing, startImport] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function analyze(content: string) {
    if (!content.trim()) {
      toast.error("Cole a planilha ou suba um arquivo.");
      return;
    }
    startAnalyze(async () => {
      const r = await analyzeFinancialAction(content);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRows(r.rows);
      toast.success(`${r.rows.length} gasto(s) detectado(s) pela IA — revise antes de gravar.`);
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => analyze(String(reader.result || ""));
    reader.readAsText(file);
  }

  function patch(i: number, p: Partial<MappedGasto>) {
    setRows((rs) => (rs ? rs.map((r, j) => (j === i ? { ...r, ...p } : r)) : rs));
  }
  function remove(i: number) {
    setRows((rs) => (rs ? rs.filter((_, j) => j !== i) : rs));
  }

  function doImport() {
    if (!rows || rows.length === 0) return;
    startImport(async () => {
      const r = await importGastosAction(rows);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.count} gasto(s) importado(s) (sem comprovante).`);
      router.push("/gastos");
      router.refresh();
    });
  }

  const total = rows?.reduce((s, r) => s + r.valorCentavos, 0) ?? 0;

  if (!rows) {
    return (
      <Card>
        <CardContent className="space-y-5 py-5">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
              <ClipboardPaste className="size-4" /> Cole a planilha (Excel/Google Sheets/CSV)
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={"Cole aqui as linhas da sua planilha financeira.\nEx.: 12/03/2026  Cordas Daddário  R$ 150,00  Loja de música"}
              className="font-mono text-xs"
            />
            <Button className="mt-2" onClick={() => analyze(text)} disabled={analyzing || !text.trim()}>
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Analisar com IA
            </Button>
          </div>
          <div className="border-t border-border pt-4">
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
              <Upload className="size-4" /> Ou suba um arquivo .csv
            </p>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={analyzing}>
              Escolher .csv
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A IA (Haiku) só organiza as colunas — você revê tudo antes de gravar. Os
            lançamentos entram marcados como <strong>importado (sem comprovante)</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} gasto(s) · total {(total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setRows(null)}>Recomeçar</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={i} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={r.descricao} onChange={(e) => patch(i, { descricao: e.target.value })} placeholder="Descrição" className="h-8 text-sm" />
                <Input value={r.recipient} onChange={(e) => patch(i, { recipient: e.target.value })} placeholder="Pra quem" className="h-8 text-sm" />
                <Input
                  value={centavosToInput(r.valorCentavos)}
                  onChange={(e) => patch(i, { valorCentavos: parseBRLToCentavos(e.target.value) })}
                  inputMode="decimal"
                  className="h-8 w-24 text-sm font-mono"
                  title="Valor (R$)"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{fmtDate(r.paidEmISO)}</span>
                {(["extra", "show"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => patch(i, { tipo: t })}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                      r.tipo === t ? "bg-primary/20 text-primary ring-primary/40" : "text-muted-foreground ring-border hover:bg-accent/50"
                    )}
                  >
                    {t === "show" ? "Show" : "Extra"}
                  </button>
                ))}
                <button type="button" onClick={() => remove(i)} title="Remover" className="text-muted-foreground hover:text-destructive">
                  <X className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex justify-end">
        <Button onClick={doImport} disabled={importing || rows.length === 0}>
          {importing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Importar {rows.length} gasto(s)
        </Button>
      </div>
    </div>
  );
}
