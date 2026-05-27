"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="size-10 text-amber-400" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Algo deu errado ao carregar</h2>
        <p className="text-sm text-muted-foreground">
          Pode ser uma versão antiga em cache. Tente recarregar.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()} variant="outline">
          <RotateCcw className="size-4" /> Tentar de novo
        </Button>
        <Button onClick={() => window.location.reload()}>Recarregar página</Button>
      </div>
    </div>
  );
}
