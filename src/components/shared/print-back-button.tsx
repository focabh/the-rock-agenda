"use client";

import { ArrowLeft } from "lucide-react";

/** Botão "Voltar" pras páginas de impressão. Some no PDF/impressão (print:hidden).
 *  Abrindo em aba nova → fecha a aba; mesma aba → volta no histórico. */
export function PrintBackButton() {
  function voltar() {
    window.close();
    setTimeout(() => {
      if (!window.closed) {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      }
    }, 150);
  }
  return (
    <button
      type="button"
      onClick={voltar}
      className="fixed left-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-lg print:hidden"
    >
      <ArrowLeft className="size-4" /> Voltar
    </button>
  );
}
