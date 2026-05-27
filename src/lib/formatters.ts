const TZ = "America/Sao_Paulo";

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

// Todas as datas são formatadas no fuso de Brasília, independente do fuso do
// servidor (o Vercel roda em UTC). Sem isso, shows à noite "pulavam" de dia.
export function formatDataBR(date: Date | number, withTime = false): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  if (!withTime) return data;
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${data} às ${hora}`;
}

export function formatDataExtensa(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Partes da data (dia/mês curto/ano) no fuso de Brasília — pros "blocos" de data. */
export function dataPartesBR(date: Date | number): {
  dia: string;
  mes: string;
  ano: string;
} {
  const d = typeof date === "number" ? new Date(date) : date;
  const part = (opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opt }).format(d);
  return {
    dia: part({ day: "2-digit" }).replace(/^0/, ""),
    mes: part({ month: "short" }).replace(".", ""),
    ano: part({ year: "numeric" }),
  };
}

export function formatDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return s > 0 ? `${m}min ${s}s` : `${m}min`;
  return `${s}s`;
}
