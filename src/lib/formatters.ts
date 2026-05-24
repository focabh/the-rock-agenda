import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

export function parseBRLToCentavos(brl: string): number {
  const cleaned = brl.replace(/[^\d,-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

export function formatDataBR(date: Date | number, withTime = false): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return format(d, withTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy", {
    locale: ptBR,
  });
}

export function formatDataExtensa(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return s > 0 ? `${m}min ${s}s` : `${m}min`;
  return `${s}s`;
}
