"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  Megaphone,
  Send,
  CalendarClock,
  Clock,
  ChevronRight,
  ChevronDown,
  BellRing,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VenueReminder, VenueReminderTipo } from "@/lib/venue-reminders";

const GROUPS: {
  tipo: VenueReminderTipo;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  cls: string;
}[] = [
  { tipo: "agradecer", label: "Agradecer shows recentes", icon: Heart, cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" },
  { tipo: "material", label: "Enviar material", icon: Megaphone, cls: "bg-primary/10 text-primary ring-primary/20" },
  { tipo: "followup", label: "Follow-up de material", icon: Send, cls: "bg-amber-500/10 text-amber-300 ring-amber-500/30" },
  { tipo: "nova_data", label: "Marcar nova data", icon: CalendarClock, cls: "bg-amber-500/10 text-amber-300 ring-amber-500/30" },
  { tipo: "sem_contato", label: "Retomar contato", icon: Clock, cls: "bg-muted text-muted-foreground ring-border" },
];

export function VenueRemindersSection({
  reminders,
}: {
  reminders: VenueReminder[];
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (reminders.length === 0) return null;

  const byTipo = new Map<VenueReminderTipo, VenueReminder[]>();
  for (const r of reminders) {
    if (!byTipo.has(r.tipo)) byTipo.set(r.tipo, []);
    byTipo.get(r.tipo)!.push(r);
  }

  function toggle(t: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
        <BellRing className="size-3.5" />
        Lembretes das casas ({reminders.length})
      </h2>
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {GROUPS.filter((g) => byTipo.get(g.tipo)?.length).map((g) => {
            const list = byTipo.get(g.tipo)!;
            const isOpen = open.has(g.tipo);
            const Icon = g.icon;
            return (
              <li key={g.tipo}>
                <button
                  type="button"
                  onClick={() => toggle(g.tipo)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30"
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                      g.cls
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium">{g.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {list.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <ul className="border-t border-border bg-muted/10">
                    {list.map((r, i) => (
                      <li key={`${r.venueId}-${i}`}>
                        <Link
                          href={`/casas/${r.venueId}`}
                          className="flex items-center justify-between gap-2 py-2 pl-16 pr-4 text-sm hover:bg-accent/30"
                        >
                          <span className="text-muted-foreground">{r.texto}</span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
