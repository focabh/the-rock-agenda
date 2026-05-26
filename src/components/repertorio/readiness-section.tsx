"use client";

import { useTransition } from "react";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setMemberReadinessAction } from "@/app/(app)/repertorio/actions";
import type { Member, SongMemberReadiness } from "@/db/schema";

type Readiness = "pronta" | "precisa_ensaiar" | "aprendendo";

const OPTIONS: Array<{ value: Readiness; label: string; dot: string; ring: string }> = [
  {
    value: "pronta",
    label: "Pronta",
    dot: "bg-emerald-400",
    ring: "ring-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  {
    value: "precisa_ensaiar",
    label: "Precisa ensaiar",
    dot: "bg-amber-400",
    ring: "ring-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  {
    value: "aprendendo",
    label: "Aprendendo",
    dot: "bg-blue-400",
    ring: "ring-blue-500/40 bg-blue-500/15 text-blue-300",
  },
];

export function ReadinessSection({
  songId,
  members,
  initial,
  isAdmin = true,
  currentMemberId = null,
}: {
  songId: string;
  members: Member[];
  initial: Array<Pick<SongMemberReadiness, "memberId" | "status">>;
  isAdmin?: boolean;
  currentMemberId?: string | null;
}) {
  const [, startTransition] = useTransition();
  const byMember = new Map(initial.map((r) => [r.memberId, r.status as Readiness]));

  function update(memberId: string, status: Readiness) {
    startTransition(async () => {
      const res = await setMemberReadinessAction(songId, memberId, status);
      if (res?.error) toast.error(res.error);
      else toast.success("Status atualizado.");
    });
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Cadastre membros em Banda para definir prontidão por músico.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h3 className="font-semibold">Prontidão por músico</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Quem já tirou essa música. Default é{" "}
          <strong className="text-foreground">aprendendo</strong>.
        </p>
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const current = byMember.get(m.id) ?? "aprendendo";
            const canEdit = isAdmin || m.id === currentMemberId;
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.nome}
                    {m.id === currentMemberId && (
                      <span className="text-xs text-primary ml-1.5">(você)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.funcao}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {OPTIONS.map((opt) => {
                    const active = current === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update(m.id, opt.value)}
                        disabled={!canEdit}
                        title={
                          canEdit ? opt.label : "Só você pode mudar a sua prontidão"
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                          active
                            ? opt.ring
                            : "ring-border text-muted-foreground hover:bg-accent/50",
                          !canEdit && "opacity-40 cursor-not-allowed hover:bg-transparent"
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", opt.dot)} />
                        <span className="hidden sm:inline">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
