"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Volta pra tela anterior (histórico do navegador). Se não houver histórico
 * interno (ex.: abriu o link direto), cai no Painel. Presente em toda tela
 * via PageHeader.
 */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1)
          router.back();
        else router.push("/");
      }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" />
      Voltar
    </button>
  );
}
