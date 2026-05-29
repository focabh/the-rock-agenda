"use client";

import { useEffect, useState } from "react";
import { Copy, Share2, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const STORAGE_KEY = "the-rock:share-message";

function defaultMessage(url: string) {
  return [
    "🤘 Oi! Sou da banda The Rock — BH.",
    "Manda uma olhada no nosso material:",
    "",
    url,
    "",
    "Press kit, vídeos e Instagram. Qualquer coisa, é só responder por aqui!",
  ].join("\n");
}

export function SharePanel() {
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState("");
  const url = origin ? `${origin}/show` : "";

  // Origem + mensagem (do localStorage ou default) só no cliente.
  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setMsg(saved ?? defaultMessage(`${o}/show`));
  }, []);

  function saveMsg(next: string) {
    setMsg(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignora se o navegador bloquear storage (modo privado etc.)
    }
  }

  function resetMsg() {
    const def = defaultMessage(url);
    setMsg(def);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignora
    }
    toast.success("Mensagem voltou pro padrão.");
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui copiar — selecione e copie manualmente.");
    }
  }

  async function copyMsg() {
    try {
      await navigator.clipboard.writeText(msg);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não consegui copiar.");
    }
  }

  function shareOnWhatsapp() {
    const text = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      {/* URL fixa */}
      <Card className="p-5 space-y-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Link da banda
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            URL fixa — não expira. O mesmo link serve pra todos os contratantes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate text-sm px-3 py-2 rounded-md bg-muted/40 text-foreground">
            {url || "Carregando…"}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={copyUrl}
            disabled={!url}
            title="Copiar link"
          >
            <Copy className="size-3.5" />
            Copiar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!url}
            render={
              <a
                href={url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir num nova aba (prévia)"
              />
            }
          >
            <ExternalLink className="size-3.5" />
            Abrir
          </Button>
        </div>
      </Card>

      {/* Mensagem padrão */}
      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label
              htmlFor="share-msg"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Mensagem padrão
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Editável. A versão que você deixa aqui fica salva no seu
              navegador.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetMsg}
            title="Voltar ao texto padrão"
            className="shrink-0 text-muted-foreground"
          >
            <RotateCcw className="size-3.5" />
            Padrão
          </Button>
        </div>
        <Textarea
          id="share-msg"
          rows={7}
          value={msg}
          onChange={(e) => saveMsg(e.target.value)}
          className="font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={copyMsg} disabled={!msg}>
            <Copy className="size-3.5" />
            Copiar mensagem
          </Button>
          <Button size="sm" onClick={shareOnWhatsapp} disabled={!msg}>
            <Share2 className="size-3.5" />
            Compartilhar no WhatsApp
          </Button>
        </div>
      </Card>
    </div>
  );
}
