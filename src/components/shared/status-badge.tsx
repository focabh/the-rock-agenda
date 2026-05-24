import { cn } from "@/lib/utils";

const SHOW_STATUS_LABELS: Record<string, string> = {
  planejado: "Planejado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const SHOW_STATUS_STYLES: Record<string, string> = {
  planejado: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  confirmado: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  concluido: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  cancelado: "bg-red-500/15 text-red-300 ring-red-500/30",
};

const PAGAMENTO_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  pago: "Pago",
  atrasado: "Atrasado",
};

const PAGAMENTO_STATUS_STYLES: Record<string, string> = {
  pendente: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  parcial: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  pago: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  atrasado: "bg-red-500/15 text-red-300 ring-red-500/30",
};

const SONG_STATUS_LABELS: Record<string, string> = {
  pronta: "Pronta",
  precisa_ensaiar: "Precisa ensaiar",
  aprendendo: "Aprendendo",
  ideia_futura: "Ideia futura",
  aposentada: "Aposentada",
};

const SONG_STATUS_STYLES: Record<string, string> = {
  pronta: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  precisa_ensaiar: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  aprendendo: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  ideia_futura: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  aposentada: "bg-zinc-700/30 text-zinc-500 ring-zinc-700/30",
};

function pill(text: string, style: string) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        style
      )}
    >
      {text}
    </span>
  );
}

export function ShowStatusBadge({ status }: { status: string }) {
  return pill(
    SHOW_STATUS_LABELS[status] ?? status,
    SHOW_STATUS_STYLES[status] ?? "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30"
  );
}

export function PagamentoStatusBadge({ status }: { status: string }) {
  return pill(
    PAGAMENTO_STATUS_LABELS[status] ?? status,
    PAGAMENTO_STATUS_STYLES[status] ?? "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30"
  );
}

export function SongStatusBadge({ status }: { status: string }) {
  return pill(
    SONG_STATUS_LABELS[status] ?? status,
    SONG_STATUS_STYLES[status] ?? "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30"
  );
}

export const SHOW_STATUS_OPTIONS = Object.entries(SHOW_STATUS_LABELS);
export const PAGAMENTO_STATUS_OPTIONS = Object.entries(PAGAMENTO_STATUS_LABELS);
export const SONG_STATUS_OPTIONS = Object.entries(SONG_STATUS_LABELS);
