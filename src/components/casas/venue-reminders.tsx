import Link from "next/link";
import {
  Heart,
  Megaphone,
  Send,
  CalendarClock,
  Clock,
  ChevronRight,
  BellRing,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VenueReminder, VenueReminderTipo } from "@/lib/venue-reminders";

const META: Record<
  VenueReminderTipo,
  { icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  agradecer: { icon: Heart, cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" },
  material: { icon: Megaphone, cls: "bg-primary/10 text-primary ring-primary/20" },
  followup: { icon: Send, cls: "bg-amber-500/10 text-amber-300 ring-amber-500/30" },
  nova_data: { icon: CalendarClock, cls: "bg-amber-500/10 text-amber-300 ring-amber-500/30" },
  sem_contato: { icon: Clock, cls: "bg-muted text-muted-foreground ring-border" },
};

export function VenueRemindersSection({
  reminders,
}: {
  reminders: VenueReminder[];
}) {
  if (reminders.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
        <BellRing className="size-3.5" />
        Lembretes das casas ({reminders.length})
      </h2>
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {reminders.map((r, i) => {
            const m = META[r.tipo];
            const Icon = m.icon;
            return (
              <li key={`${r.venueId}-${i}`}>
                <Link
                  href={`/casas/${r.venueId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30"
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                      m.cls
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <p className="flex-1 text-sm">{r.texto}</p>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
