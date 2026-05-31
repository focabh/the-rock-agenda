"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinanceExport({ ano }: { ano: number }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" render={<a href={`/financeiro/csv?ano=${ano}`} />}>
        <Download className="size-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> PDF
      </Button>
    </div>
  );
}
