const MAP: Record<string, { label: string; cls: string }> = {
  planejado: {
    label: "Planejado",
    cls: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  },
  confirmado: {
    label: "Confirmado",
    cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  },
  cancelado: {
    label: "Cancelado",
    cls: "bg-muted text-muted-foreground ring-border line-through",
  },
};

export function EnsaioStatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? MAP.planejado;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
