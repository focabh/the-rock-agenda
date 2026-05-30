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

/** Só a hora (HH:mm) no fuso de Brasília. */
export function formatHoraBR(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Offset de São Paulo (em ms) no instante dado — hoje sempre -3h. */
function brOffsetMs(utcMs: number): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(new Date(utcMs))
    .reduce<Record<string, string>>((a, x) => {
      a[x.type] = x.value;
      return a;
    }, {});
  let hour = Number(p.hour);
  if (hour === 24) hour = 0;
  const asIfUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second)
  );
  return asIfUTC - utcMs;
}

// Converte um "YYYY-MM-DDTHH:mm" (valor de <input datetime-local>) interpretado
// como horário de Brasília no instante UTC correto. Sem isso, o servidor em UTC
// (Vercel) grava o show 3h adiantado.
export function parseBRDateTime(input: string): Date {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return new Date(input);
  const [, y, mo, d, h, mi] = m.map(Number);
  const naiveUTC = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(naiveUTC - brOffsetMs(naiveUTC));
}

// Formata um instante como "YYYY-MM-DDTHH:mm" no fuso de Brasília, pro valor
// inicial de um <input datetime-local> (independente do fuso do dispositivo).
export function toBRDatetimeLocal(date: Date | number | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "number" ? new Date(date) : date;
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => {
      a[x.type] = x.value;
      return a;
    }, {});
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
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

/**
 * Tempo relativo curto em pt-BR: "agora", "há 5 min", "há 3 h", "há 2 d".
 * Acima de 7 dias cai pra data absoluta. Calcule no servidor e passe a string
 * pro cliente pra evitar mismatch de hidratação (o "now" difere).
 */
export function formatRelativeBR(date: Date | number, now: Date | number = new Date()): string {
  const then = typeof date === "number" ? date : date.getTime();
  const ref = typeof now === "number" ? now : now.getTime();
  const diffMs = ref - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d <= 7) return `há ${d} d`;
  return formatDataBR(then);
}

export function formatDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return s > 0 ? `${m}min ${s}s` : `${m}min`;
  return `${s}s`;
}
