"use client";

import { useEffect } from "react";

/** Dispara o diálogo de impressão automaticamente ao abrir a página. */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
