"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RiderActions({ texto }: { texto: string }) {
  function whats() {
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  }
  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> Imprimir / PDF
      </Button>
      <Button variant="outline" size="sm" onClick={whats}>
        WhatsApp
      </Button>
    </div>
  );
}
