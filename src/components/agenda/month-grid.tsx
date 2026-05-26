"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { colorForMember, brDateKey } from "@/lib/conflicts";
import { DayDialog } from "@/components/agenda/day-dialog";
import type {
  Show,
  Venue,
  Member,
  MemberUnavailability,
  Rehearsal,
} from "@/db/schema";

type ShowItem = Show & { casa: Venue };

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function MonthGrid({
  year,
  month,
  shows,
  blocks,
  members,
  rehearsals = [],
  isAdmin = false,
  currentMemberId = null,
}: {
  year: number;
  month: number;
  shows: ShowItem[];
  blocks: MemberUnavailability[];
  members: Member[];
  rehearsals?: Rehearsal[];
  isAdmin?: boolean;
  currentMemberId?: string | null;
}) {
  const [selected, setSelected] = useState<{ key: string; date: Date } | null>(
    null
  );
  const [open, setOpen] = useState(false);

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Semana começa segunda (0=segunda, 6=domingo)
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const todayKey = brDateKey(new Date());

  type Cell = { key: string; day: number } | null;
  const cells: Cell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ key: dayKey(year, month, d), day: d });
  while (cells.length % 7 !== 0) cells.push(null);

  const membersById = new Map(members.map((m) => [m.id, m]));

  // Agrupar shows, ensaios e bloqueios por dayKey (BR)
  const showsByDay = new Map<string, ShowItem[]>();
  for (const s of shows) {
    const k = brDateKey(s.data);
    if (!showsByDay.has(k)) showsByDay.set(k, []);
    showsByDay.get(k)!.push(s);
  }

  const rehearsalsByDay = new Map<string, Rehearsal[]>();
  for (const r of rehearsals) {
    const k = brDateKey(r.data);
    if (!rehearsalsByDay.has(k)) rehearsalsByDay.set(k, []);
    rehearsalsByDay.get(k)!.push(r);
  }

  function openDay(cellKey: string, day: number) {
    setSelected({ key: cellKey, date: new Date(year, month, day) });
    setOpen(true);
  }

  const selectedShows = selected ? (showsByDay.get(selected.key) ?? []) : [];
  const selectedRehearsals = selected
    ? (rehearsalsByDay.get(selected.key) ?? [])
    : [];

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card">
      <div className="grid grid-cols-7 border-b border-border">
        {DOW.map((d) => (
          <div
            key={d}
            className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground text-center font-medium"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          if (!cell) {
            return (
              <div
                key={i}
                className="h-28 md:h-32 border-r border-b border-border last:border-r-0 bg-muted/20"
              />
            );
          }
          const isToday = cell.key === todayKey;
          const dayShows = showsByDay.get(cell.key) ?? [];
          const dayRehearsals = rehearsalsByDay.get(cell.key) ?? [];
          const dayBlocks = blocks.filter((b) => {
            const startKey = brDateKey(b.dataInicio);
            const endKey = brDateKey(b.dataFim);
            return startKey <= cell.key && cell.key <= endKey;
          });

          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => openDay(cell.key, cell.day)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDay(cell.key, cell.day);
                }
              }}
              className={cn(
                "h-28 md:h-32 border-r border-b border-border last:border-r-0 p-1.5 overflow-hidden cursor-pointer hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary/40 transition-colors",
                isToday && "bg-primary/5 ring-1 ring-inset ring-primary/30"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-mono w-5 h-5 inline-flex items-center justify-center rounded",
                    isToday
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground"
                  )}
                >
                  {cell.day}
                </span>
                {dayBlocks.length > 0 && dayShows.length > 0 && (
                  <span
                    className="text-[9px] uppercase font-bold text-amber-400"
                    title="Conflito"
                  >
                    ⚠
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayShows.map((s) => (
                  <Link
                    key={s.id}
                    href={`/shows/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block truncate text-[10px] leading-tight px-1.5 py-1 rounded bg-primary/20 text-primary-foreground ring-1 ring-primary/40 font-medium hover:bg-primary/30"
                    title={`${s.casa.nome} — ${s.status}`}
                  >
                    {s.inicio && (
                      <span className="font-mono opacity-70 mr-1">
                        {s.inicio}
                      </span>
                    )}
                    {s.casa.nome}
                  </Link>
                ))}
                {dayRehearsals.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "truncate text-[10px] leading-tight px-1.5 py-1 rounded ring-1 font-medium",
                      r.status === "cancelado"
                        ? "bg-muted text-muted-foreground ring-border line-through"
                        : "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40"
                    )}
                    title={`Ensaio${r.inicio ? " " + r.inicio : ""}${
                      r.local ? " · " + r.local : ""
                    }${r.foco ? " — " + r.foco : ""}`}
                  >
                    {r.inicio && (
                      <span className="font-mono opacity-70 mr-1">
                        {r.inicio}
                      </span>
                    )}
                    Ensaio
                  </div>
                ))}
                {dayBlocks.slice(0, 3).map((b) => {
                  const m = membersById.get(b.memberId);
                  if (!m) return null;
                  const c = colorForMember(m.id);
                  return (
                    <div
                      key={b.id}
                      className="truncate text-[10px] leading-tight px-1.5 py-0.5 rounded ring-1"
                      style={{
                        backgroundColor: c.bg,
                        color: c.text,
                        borderColor: c.ring,
                      }}
                      title={`${m.nome}${b.motivo ? " — " + b.motivo : ""}`}
                    >
                      {m.nome.split(" ")[0]}
                      {b.motivo && (
                        <span className="opacity-70"> · {b.motivo}</span>
                      )}
                    </div>
                  );
                })}
                {dayBlocks.length > 3 && (
                  <div className="text-[9px] text-muted-foreground px-1.5">
                    +{dayBlocks.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DayDialog
        date={selected?.date ?? null}
        open={open}
        onOpenChange={setOpen}
        shows={selectedShows}
        rehearsals={selectedRehearsals}
        isAdmin={isAdmin}
        currentMemberId={currentMemberId}
        members={members}
      />
    </div>
  );
}
