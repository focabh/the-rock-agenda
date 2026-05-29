"use client";

import { useEffect, useState } from "react";
import { Copy, Share2, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// v2: agora a mensagem usa placeholder {link} (separado do URL). v1
// guardava o URL embutido como texto, então ficava dessincronizado quando
// o admin mudava o limite de vídeos.
const STORAGE_MSG = "the-rock:share-message:v2";
const STORAGE_LIMIT_ON = "the-rock:share-limit-on";
const STORAGE_LIMIT_N = "the-rock:share-limit-n";

const DEFAULT_MESSAGE = [
  "🤘 Oi! Sou da banda The Rock — BH.",
  "Manda uma olhada no nosso material:",
  "",
  "{link}",
  "",
  "Press kit, vídeos e Instagram. Qualquer coisa, é só responder por aqui!",
].join("\n");

export function SharePanel() {
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState("");
  const [limitOn, setLimitOn] = useState(true);
  const [limitN, setLimitN] = useState(3);

  // Carrega tudo do localStorage só no cliente.
  useEffect(() => {
    setOrigin(window.location.origin);
    setMsg(window.localStorage.getItem(STORAGE_MSG) ?? DEFAULT_MESSAGE);
    const lOn = window.localStorage.getItem(STORAGE_LIMIT_ON);
    if (lOn !== null) setLimitOn(lOn === "1");
    const lN = window.localStorage.getItem(STORAGE_LIMIT_N);
    if (lN !== null) {
      const n = Number.parseInt(lN, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 10) setLimitN(n);
    }
  }, []);

  // URL que vai pra mensagem.
  const url = origin
    ? `${origin}/show${limitOn ? `?v=${limitN}` : ""}`
    : "";

  // Texto final a ser compartilhado (placeholder resolvido).
  const resolved = msg.replace(/\{link\}/g, url);

  function saveMsg(next: string) {
    setMsg(next);
    try {
      window.localStorage.setItem(STORAGE_MSG, next);
    } catch {
      // ignora — modo privado etc.
    }
  }

  function setLimitOnPersist(next: boolean) {
    setLimitOn(next);
    try {
      window.localStorage.setItem(STORAGE_LIMIT_ON, next ? "1" : "0");
    } catch {
      // ignora
    }
  }

  function setLimitNPersist(next: number) {
    const clamped = Math.max(1, Math.min(10, Math.floor(next)));
    setLimitN(clamped);
    try {
      window.localStorage.setItem(STORAGE_LIMIT_N, String(clamped));
    } catch {
      // ignora
    }
  }

  function resetMsg() {
    setMsg(DEFAULT_MESSAGE);
    try {
      window.localStorage.removeItem(STORAGE_MSG);
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
      await navigator.clipboard.writeText(resolved);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não consegui copiar.");
    }
  }

  function shareOnWhatsapp() {
    const text = encodeURIComponent(resolved);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  const hasLinkPlaceholder = msg.includes("{link}");

  return (
    <div className="space-y-4">
      {/* URL gerada */}
      <Card className="p-5 space-y-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Link da banda
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            URL única — não expira. O parâmetro {" "}
            <code className="text-foreground">?v=N</code> faz a página mostrar
            só os N primeiros vídeos pro contratante.
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
                title="Abrir o link em uma nova aba (prévia)"
              />
            }
          >
            <ExternalLink className="size-3.5" />
            Abrir
          </Button>
        </div>

        {/* Limite de vídeos */}
        <div className="flex items-center gap-3 pt-1 border-t border-border mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={limitOn}
              onChange={(e) => setLimitOnPersist(e.target.checked)}
              className="size-4 accent-primary cursor-pointer"
            />
            <span className="text-sm">Mostrar só os primeiros</span>
          </label>
          <Input
            type="number"
            min={1}
            max={10}
            value={limitN}
            onChange={(e) => setLimitNPersist(Number(e.target.value))}
            disabled={!limitOn}
            className="w-16 h-8 text-center"
          />
          <span className="text-sm text-muted-foreground">
            vídeos {limitOn ? "" : "(desativado: mostra todos)"}
          </span>
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
              Use <code className="text-foreground">{"{link}"}</code> onde o
              link deve aparecer — ele é substituído no envio. Texto fica
              salvo no seu navegador.
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
        {!hasLinkPlaceholder && (
          <p className="text-xs text-amber-300">
            ⚠️ Sua mensagem não tem <code>{"{link}"}</code> — o link da banda
            não vai junto. Cole <code>{"{link}"}</code> onde quiser que ele
            apareça.
          </p>
        )}
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
