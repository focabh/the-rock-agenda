import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
  hideBackButton = false,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Use no Painel (página raiz) pra não duplicar o link com ele mesmo. */
  hideBackButton?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-border px-6 py-6">
      <div className="space-y-1 min-w-0">
        {!hideBackButton && (
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Painel
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
