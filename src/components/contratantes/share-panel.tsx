"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Share2, ExternalLink, RotateCcw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// v2: mensagem com placeholder {link} em vez de URL embutido.
const STORAGE_MSG = "the-rock:share-message:v2";
// v2: seleção agora é uma lista de IDs (era um número).
const STORAGE_SELECTED = "the-rock:share-selected-videos:v2";

const DEFAULT_MESSAGE = [
  "🤘 Oi! Sou da banda The Rock — BH.",
  "Manda uma olhada no nosso material:",
  "",
  "{link}",
  "",
  "Press kit, vídeos e Instagram. Qualquer coisa, é só responder por aqui!",
].join("\n");

const DEFAULT_VIDEO_COUNT = 3;

export type VideoLite = { id: string; titulo: string };

export function SharePanel({ videos }: { videos: VideoLite[] }) {
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Carrega tudo no cliente. Filtra IDs do storage contra os vídeos atuais
  // pra descartar referências mortas (vídeos deletados).
  useEffect(() => {
    setOrigin(window.location.origin);
    setMsg(window.localStorage.getItem(STORAGE_MSG) ?? DEFAULT_MESSAGE);

    const validIds = new Set(videos.map((v) => v.id));
    const saved = window.localStorage.getItem(STORAGE_SELECTED);
    if (saved !== null) {
      try {
        const arr = JSON.parse(saved) as unknown;
        if (Array.isArray(arr)) {
          const filtered = arr.filter(
            (id): id is string => typeof id === "string" && validIds.has(id)
          );
          setSelected(new Set(filtered));
          return;
        }
      } catch {
        // formato inválido — ignora e cai no default.
      }
    }
    // Default: primeiros N vídeos marcados.
    setSelected(new Set(videos.slice(0, DEFAULT_VIDEO_COUNT).map((v) => v.id)));
  }, [videos]);

  // URL final, sensível ao estado atual da seleção.
  // Usa índices 1-based pra deixar a URL curta no WhatsApp.
  // (Risco de drift se mexer no cadastro entre enviar e o contratante
  // abrir é minúsculo no fluxo real.)
  const url = useMemo(() => {
    if (!origin) return "";
    const base = `${origin}/show`;
    const total = videos.length;
    if (selected.size === total) return base; // todos: omite ?v
    if (selected.size === 0) return `${base}?v=`; // nenhum: ?v vazio
    const indices = videos
      .map((v, i) => (selected.has(v.id) ? i + 1 : null))
      .filter((x): x is number => x !== null);
    return `${base}?v=${indices.join(",")}`;
  }, [origin, videos, selected]);

  const resolved = msg.replace(/\{link\}/g, url);

  function persistSelected(next: Set<string>) {
    setSelected(next);
    try {
      window.localStorage.setItem(
        STORAGE_SELECTED,
        JSON.stringify([...next])
      );
    } catch {
      // ignora
    }
  }

  function toggleVideo(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistSelected(next);
  }

  function selectAll() {
    persistSelected(new Set(videos.map((v) => v.id)));
  }

  function clearAll() {
    persistSelected(new Set());
  }

  function selectFirstN() {
    persistSelected(
      new Set(videos.slice(0, DEFAULT_VIDEO_COUNT).map((v) => v.id))
    );
  }

  function saveMsg(next: string) {
    setMsg(next);
    try {
      window.localStorage.setItem(STORAGE_MSG, next);
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
  const total = videos.length;
  const count = selected.size;

  return (
    <div className="space-y-4">
      {/* URL gerada */}
      <Card className="p-5 space-y-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Link da banda
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            URL única — não expira. Os vídeos selecionados abaixo ficam
            embutidos como parâmetro <code className="text-foreground">?v=</code>.
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
      </Card>

      {/* Vídeos a enviar */}
      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Video className="size-3.5" />
              Vídeos a enviar
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {count} de {total} selecionados. Press kit e Instagram vão
              sempre, independente do que estiver marcado aqui.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectFirstN}
              className="text-muted-foreground"
              disabled={total === 0}
            >
              {DEFAULT_VIDEO_COUNT} primeiros
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="text-muted-foreground"
              disabled={total === 0 || count === total}
            >
              Marcar todos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-muted-foreground"
              disabled={count === 0}
            >
              Limpar
            </Button>
          </div>
        </div>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum vídeo cadastrado ainda — adicione em{" "}
            <a href="/divulgacao" className="text-primary hover:underline">
              Material da banda
            </a>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {videos.map((v) => (
              <li key={v.id}>
                <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/30">
                  <input
                    type="checkbox"
                    checked={selected.has(v.id)}
                    onChange={() => toggleVideo(v.id)}
                    className="size-4 accent-primary cursor-pointer"
                  />
                  <span className="flex-1 text-sm truncate">{v.titulo}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
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
