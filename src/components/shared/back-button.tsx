"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Vai pra TELA ANTERIOR de verdade — sobe um nível na rota (ex.: /shows/123/editar
 * → /shows/123 → /shows → /). Não usa o histórico do navegador (que reproduzia
 * mudanças de filtro/estado da própria tela). Presente em toda tela via PageHeader.
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  function parent() {
    const segs = (pathname ?? "/").split("/").filter(Boolean);
    if (segs.length <= 1) return "/";
    segs.pop();
    return "/" + segs.join("/");
  }

  return (
    <button
      type="button"
      onClick={() => router.push(parent())}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" />
      Voltar
    </button>
  );
}
