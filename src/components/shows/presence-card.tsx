"use client";

import { useTransition } from "react";
import { Check, X, HelpCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setPresenceAction } from "@/app/(app)/shows/[id]/actions-presence";
import type { Member, ShowMemberPresence } from "@/db/schema";

type Status = "pendente" | "confirmado" | "recusado";

const STATUS_LABEL: Record<Status, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  recusado: "Recusado",
};

export function PresenceCard({
  showId,
  members,
  presences,
  currentMemberId,
  admin,
}: {
  showId: string;
  members: Member[];
  presences: ShowMemberPresence[];
  currentMemberId: string | null;
  admin: boolean;
}) {
  const [, startTransition] = useTransition();
  const byMember = new Map(presences.map((p) => [p.memberId, p]));

  const confirmados = members.filter(
    (m) => byMember.get(m.id)?.status === "confirmado"
  ).length;
  const recusados = members.filter(
    (m) => byMember.get(m.id)?.status === "recusado"
  ).length;

  function update(memberId: string, status: Status) {
    startTransition(async () => {
      const result = await setPresenceAction(showId, memberId, status);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Presença atualizada.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Presença dos músicos
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {confirmados} confirmado(s), {recusados} recusado(s), {members.length - confirmados - recusados} pendente(s)
          </p>
        </div>
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
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      {m.nome}
                      {isOwn && (
                        <span className="text-[10px] uppercase tracking-wider text-primary">
                          você
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.funcao}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
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
                    </div>
                  ) : (
                    <StatusPill status={status} />
                  )}
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
