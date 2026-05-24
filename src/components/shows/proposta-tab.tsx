"use client";

import { useState, useTransition } from "react";
import { Copy, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  savePropostaAction,
  generateDefaultPropostaAction,
} from "@/app/(app)/shows/[id]/actions-evaluation";
import type { ShowProposta } from "@/db/schema";

export function PropostaTab({
  showId,
  proposta,
}: {
  showId: string;
  proposta: ShowProposta | null;
}) {
  const [corpo, setCorpo] = useState(proposta?.corpoMarkdown ?? "");
  const [, startTransition] = useTransition();
  const [pendingGen, setPendingGen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  async function handleGenerate() {
    setPendingGen(true);
    try {
      const md = await generateDefaultPropostaAction(showId);
      setCorpo(md);
      toast.success("Proposta gerada com base nos dados do show.");
    } finally {
      setPendingGen(false);
    }
  }

  function handleSave() {
    setPendingSave(true);
    startTransition(async () => {
      await savePropostaAction(showId, corpo);
      setPendingSave(false);
      toast.success("Proposta salva.");
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(corpo);
    toast.success("Copiada para a área de transferência.");
  }

  function handlePrint() {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Proposta — The Rock</title>
      <style>
        body { font-family: Georgia, serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.55; }
        h1 { font-size: 22px; border-bottom: 2px solid #111; padding-bottom: 6px; }
        h2 { font-size: 16px; margin-top: 24px; }
        hr { margin: 32px 0; border: 0; border-top: 1px solid #ddd; }
        pre { white-space: pre-wrap; font-family: inherit; }
      </style></head><body><pre>${corpo
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={handleGenerate}
          disabled={pendingGen}
          title="Gerar a partir dos dados do show"
        >
          <FileText className="size-4" />
          {corpo ? "Regerar do template" : "Gerar do template"}
        </Button>
        <Button
          variant="outline"
          onClick={handleCopy}
          disabled={!corpo}
        >
          <Copy className="size-4" />
          Copiar
        </Button>
        <Button
          variant="outline"
          onClick={handlePrint}
          disabled={!corpo}
        >
          <Printer className="size-4" />
          Imprimir
        </Button>
        <Button
          className="ml-auto"
          onClick={handleSave}
          disabled={pendingSave || !corpo}
        >
          {pendingSave ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <Textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={26}
            placeholder='Clique em "Gerar do template" pra criar uma proposta com os dados do show, ou escreva do zero. Suporta markdown.'
            className="font-mono text-xs"
          />
        </CardContent>
      </Card>
    </div>
  );
}
