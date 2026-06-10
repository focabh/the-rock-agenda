"use client";

import { useEffect, useState } from "react";
import { Copy, Check, CalendarPlus, Download } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Mostra o link do feed .ics da banda + atalhos pra assinar no Google/Apple.
 *  Mão única (app → sua agenda): atualiza sozinho quando o calendário
 *  re-sincroniza. */
export function CalendarSubscribe({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(`${window.location.origin}/api/calendar/${token}/feed.ics`);
    }
  }, [token]);

  const webcal = url.replace(/^https?:/, "webcal:");
  const googleAdd = url
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`
    : "#";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado! Cole na sua agenda como 'assinar por URL'.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não consegui copiar.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground"
        />
        <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
          {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" render={<a href={googleAdd} target="_blank" rel="noreferrer" />}>
          <CalendarPlus className="size-4" /> Google Agenda
        </Button>
        <Button variant="outline" size="sm" render={<a href={webcal} />}>
          <Download className="size-4" /> Apple / Outlook
        </Button>
        <Button variant="ghost" size="sm" render={<Link href="/agenda/importar" />}>
          Importar de outra agenda →
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Assine uma vez e a agenda da banda (shows + ensaios) aparece junto da sua
        e atualiza sozinha. Quem tiver este link vê a agenda — não compartilhe à toa.
      </p>
    </div>
  );
}
