"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botão "Avisar a banda".
 *
 * Antes mandava Web Push (que basicamente ninguém ativou). Agora abre o
 * WhatsApp com uma mensagem pronta — o admin escolhe o grupo da banda e
 * aperta enviar. Sem fricção, sem dependência de permissão de push.
 *
 * - `title` vira o header em negrito da mensagem.
 * - `body` é o corpo (data/hora/local + chamada).
 * - `url` (opcional) é convertido em URL absoluta e anexado no final
 *   pra que o link fique clicável no WhatsApp e leve direto pro item.
 */
export function NotifyBandButton({
  title,
  body,
  url,
  label = "Avisar a banda",
  variant = "outline",
}: {
  title: string;
  body: string;
  url?: string;
  /** Mantido por compat com call sites antigos — não usado. */
  tag?: string;
  label?: string;
  variant?: "outline" | "default" | "ghost";
}) {
  function go() {
    const fullUrl = url
      ? `${window.location.origin}${url.startsWith("/") ? url : "/" + url}`
      : "";
    const lines = [`🎸 *${title}*`, "", body];
    if (fullUrl) lines.push("", fullUrl);
    const text = encodeURIComponent(lines.join("\n"));
    window.open(
      `https://wa.me/?text=${text}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <Button variant={variant} size="sm" onClick={go}>
      <MessageCircle className="size-4" />
      {label}
    </Button>
  );
}
