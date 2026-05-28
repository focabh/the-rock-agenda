"use client";

import { useState, useTransition } from "react";
import {
  Copy,
  Trash2,
  Ban,
  Clock,
  Share2,
  CheckCircle2,
  ExternalLink,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDataBR } from "@/lib/formatters";
import { toast } from "sonner";
import {
  deleteContractorLinkAction,
  extendContractorLinkAction,
  revokeContractorLinkAction,
} from "@/app/(app)/contratantes/actions";

type Row = {
  id: string;
  token: string;
  label: string | null;
  expiresEmISO: string;
  revokedEmISO: string | null;
  viewCount: number;
  lastViewedEmISO: string | null;
  createdAtISO: string;
  createdById: string | null;
  creator: string;
};

function status(r: Row): "ativo" | "expirado" | "revogado" {
  if (r.revokedEmISO) return "revogado";
  if (new Date(r.expiresEmISO).getTime() < Date.now()) return "expirado";
  return "ativo";
}

export function ContratantesList({
  links,
  currentUserId,
  admin,
}: {
  links: Row[];
  currentUserId: string;
  admin: boolean;
}) {
  return (
    <ul className="divide-y divide-border">
      {links.map((r) => (
        <LinkRow
          key={r.id}
          r={r}
          canManage={admin || r.createdById === currentUserId}
        />
      ))}
    </ul>
  );
}

function LinkRow({ r, canManage }: { r: Row; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [extending, setExtending] = useState(false);
  const s = status(r);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/${r.token}`
      : `/c/${r.token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui copiar — copie manualmente da barra.");
    }
  }

  function revoke() {
    if (!confirm("Revogar este link agora? Ele para de funcionar imediatamente.")) return;
    startTransition(async () => {
      await revokeContractorLinkAction(r.id);
      toast.success("Link revogado.");
    });
  }

  function remove() {
    if (!confirm("Apagar este link permanentemente?")) return;
    startTransition(async () => {
      await deleteContractorLinkAction(r.id);
      toast.success("Link removido.");
    });
  }

  function extendByDays(days: number) {
    startTransition(async () => {
      await extendContractorLinkAction(r.id, days);
      toast.success(`Validade estendida por ${days} dia(s).`);
      setExtending(false);
    });
  }

  return (
    <li className="px-5 py-4 space-y-2">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-md shrink-0 ring-1",
            s === "ativo" &&
              "bg-emerald-500/10 ring-emerald-500/30 text-emerald-300",
            s === "expirado" &&
              "bg-zinc-500/10 ring-zinc-500/30 text-zinc-300",
            s === "revogado" &&
              "bg-red-500/10 ring-red-500/30 text-red-300"
          )}
        >
          <Share2 className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {r.label || "Link sem rótulo"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {s === "ativo" && (
              <>
                <Clock className="size-3 inline -mt-0.5" /> Expira em{" "}
                {formatDataBR(new Date(r.expiresEmISO))}
              </>
            )}
            {s === "expirado" && (
              <>Expirou em {formatDataBR(new Date(r.expiresEmISO))}</>
            )}
            {s === "revogado" && (
              <>Revogado em {formatDataBR(new Date(r.revokedEmISO!))}</>
            )}
            {" · "}
            {r.viewCount} visita{r.viewCount === 1 ? "" : "s"}
            {r.lastViewedEmISO && (
              <>
                {" · última em "}
                {formatDataBR(new Date(r.lastViewedEmISO))}
              </>
            )}
            {r.creator && <> · por {r.creator}</>}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset shrink-0",
            s === "ativo" &&
              "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
            s === "expirado" &&
              "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
            s === "revogado" && "bg-red-500/15 text-red-300 ring-red-500/40"
          )}
        >
          {s === "ativo" && <CheckCircle2 className="size-3" />}
          {s === "ativo" ? "Ativo" : s === "expirado" ? "Expirado" : "Revogado"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <code className="text-xs px-2 py-1 rounded bg-muted/40 text-muted-foreground truncate max-w-full">
          {url}
        </code>
        <div className="flex items-center gap-1 ml-auto">
          <Button size="sm" variant="outline" onClick={copy} disabled={pending}>
            <Copy className="size-3.5" />
            Copiar
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<a href={url} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink className="size-3.5" />
            Abrir
          </Button>
          {canManage &&
            (extending ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => extendByDays(7)}
                  disabled={pending}
                >
                  +7 dias
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => extendByDays(30)}
                  disabled={pending}
                >
                  +30 dias
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExtending(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                title="Estender"
                onClick={() => setExtending(true)}
                disabled={pending}
              >
                <CalendarPlus className="size-3.5" />
              </Button>
            ))}
          {canManage && s === "ativo" && (
            <Button
              size="sm"
              variant="ghost"
              title="Revogar agora"
              onClick={revoke}
              disabled={pending}
              className="text-muted-foreground hover:text-amber-300"
            >
              <Ban className="size-3.5" />
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              title="Apagar"
              onClick={remove}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
