"use client";

import { useTransition } from "react";
import { Check, X, HelpCircle, Users, MessageCircle, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Member } from "@/db/schema";

type Status = "pendente" | "confirmado" | "recusado";

type PresenceLite = { memberId: string; status: string };
type PresenceAction = (
  eventId: string,
  memberId: string,
  status: Status,
  viaPush?: boolean
) => Promise<{ error?: string } | { ok?: boolean } | void>;

const STATUS_LABEL: Record<Status, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  recusado: "Recusado",
};

export type PresenceWa = {
  label: string; // "show" | "ensaio"
  quando: string; // ex: "dia 12/07 às 21:00"
  local: string; // casa ou local (pode ser vazio)
  path: string; // ex: "/shows/123"
};

function waNumber(telefone: string): string {
  const d = telefone.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

export function PresenceCard({
  eventId,
  action,
  members,
  presences,
  currentMemberId,
  admin,
  wa,
  groupLink = null,
  pushHint = false,
}: {
  eventId: string;
  action: PresenceAction;
  members: Member[];
  presences: PresenceLite[];
  currentMemberId: string | null;
  admin: boolean;
  wa: PresenceWa;
  /** Link de convite do grupo da banda no WhatsApp (opcional). */
  groupLink?: string | null;
  /** Abriu via notificação (?p=1) — marca a confirmação como "via push". */
  pushHint?: boolean;
}) {
  const [, startTransition] = useTransition();
  const byMember = new Map(presences.map((p) => [p.memberId, p]));

  const url =
    typeof window !== "undefined" ? `${window.location.origin}${wa.path}` : "";
  const localTxt = wa.local ? ` — ${wa.local}` : "";

  function msgPara(nome: string): string {
    const primeiro = nome.split(" ")[0];
    return `Oi ${primeiro}! Tem ${wa.label} ${wa.quando}${localTxt}. Confirma sua presença aqui: ${url}`;
  }

  function waLinkPara(m: Member): string {
    return `https://wa.me/${waNumber(m.telefone ?? "")}?text=${encodeURIComponent(
      msgPara(m.nome)
    )}`;
  }

  function avisarBanda() {
    const L = wa.label.charAt(0).toUpperCase() + wa.label.slice(1);
    const msg = `🎸 ${L} da banda ${wa.quando}${localTxt}!\nConfirmem presença: ${url}`;
    navigator.clipboard
      .writeText(msg)
      .then(() => {
        if (groupLink) {
          toast.success("Mensagem copiada — abrindo o grupo. Cole e envie.");
          window.open(groupLink, "_blank");
        } else {
          toast.success("Mensagem copiada — cole no grupo da banda.");
        }
      })
      .catch(() => toast.error("Não consegui copiar."));
  }

  const confirmados = members.filter(
    (m) => byMember.get(m.id)?.status === "confirmado"
  ).length;
  const recusados = members.filter(
    (m) => byMember.get(m.id)?.status === "recusado"
  ).length;

  function update(memberId: string, status: Status) {
    startTransition(async () => {
      const result = await action(eventId, memberId, status, pushHint && status === "confirmado");
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Presença atualizada.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 shrink-0" />
            Presença dos músicos
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {confirmados} confirmado(s), {recusados} recusado(s), {members.length - confirmados - recusados} pendente(s)
          </p>
        </div>
        {admin && members.length > 0 && (
          <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={avisarBanda}>
            <Send className="size-4" />
            Avisar a banda
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cadastre membros em Banda para confirmar presença.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const p = byMember.get(m.id);
              const status: Status = (p?.status as Status) ?? "pendente";
              const isOwn = currentMemberId === m.id;
              const canEdit = admin || isOwn;

              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span className="min-w-0 truncate">{m.nome}</span>
                      {isOwn && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-primary">
                          você
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.funcao}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    {admin && m.telefone && (
                      <a
                        href={waLinkPara(m)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Pedir confirmação a ${m.nome} no WhatsApp`}
                        className="inline-flex items-center justify-center size-7 rounded text-emerald-400 hover:bg-emerald-500/15"
                      >
                        <MessageCircle className="size-4" />
                      </a>
                    )}
                    {canEdit ? (
                      <>
                        <PresenceButton
                          active={status === "confirmado"}
                          onClick={() => update(m.id, "confirmado")}
                          color="emerald"
                          icon={<Check className="size-3.5" />}
                          label="Sim"
                        />
                        <PresenceButton
                          active={status === "recusado"}
                          onClick={() => update(m.id, "recusado")}
                          color="red"
                          icon={<X className="size-3.5" />}
                          label="Não"
                        />
                        <PresenceButton
                          active={status === "pendente"}
                          onClick={() => update(m.id, "pendente")}
                          color="zinc"
                          icon={<HelpCircle className="size-3.5" />}
                          label="?"
                        />
                      </>
                    ) : (
                      <StatusPill status={status} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PresenceButton({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: "emerald" | "red" | "zinc";
  icon: React.ReactNode;
  label: string;
}) {
  const colorMap = {
    emerald: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
    red: "bg-red-500/20 text-red-300 ring-red-500/40",
    zinc: "bg-zinc-500/20 text-zinc-300 ring-zinc-500/40",
  } as const;
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ring-1 transition-all",
        active
          ? colorMap[color]
          : "ring-transparent text-muted-foreground hover:bg-accent/50"
      )}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    confirmado: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    recusado: "bg-red-500/15 text-red-300 ring-red-500/30",
    pendente: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
