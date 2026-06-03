import { Database, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Exporta um backup (JSON) dos dados da banda. Link direto pra rota /api/backup. */
export function BackupCard() {
  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 shrink-0">
            <Database className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">Backup dos dados</h3>
            <p className="text-sm text-muted-foreground">
              Baixe um arquivo com tudo da banda — músicas, casas, shows, setlists,
              ensaios e financeiro. Guarde de vez em quando, por segurança.
            </p>
          </div>
        </div>
        <a
          href="/api/backup"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="size-4" /> Exportar backup (JSON)
        </a>
      </CardContent>
    </Card>
  );
}
