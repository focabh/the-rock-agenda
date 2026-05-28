"use client";

import { useEffect, useState } from "react";
import { FileText, Maximize2, X } from "lucide-react";
import { PressKitViewer } from "@/components/contratantes/press-kit-viewer";

/**
 * Seção de press kit que pode abrir em "tela cheia" via modal (em vez de
 * abrir uma aba nova do PDF, que no celular não tem como fechar).
 */
export function PressKitSection({ src }: { src: string }) {
  const [full, setFull] = useState(false);

  // Bloqueia scroll do body enquanto modal aberta + fecha com ESC.
  useEffect(() => {
    if (!full) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          Press kit
        </h1>
        <button
          type="button"
          onClick={() => setFull(true)}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Maximize2 className="size-3.5" />
          Abrir tela cheia
        </button>
      </div>
      <PressKitViewer src={src} fallbackHref={src} />

      {full && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
            <p className="font-semibold flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Press kit
            </p>
            <button
              type="button"
              onClick={() => setFull(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent/40"
              aria-label="Fechar"
            >
              <X className="size-4" />
              Fechar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto">
              <PressKitViewer src={src} fallbackHref={src} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
