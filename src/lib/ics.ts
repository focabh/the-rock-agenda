// iCalendar (.ics) — geração (feed da agenda) e parsing (import). Sem dependência.
// Single-timezone (banda numa cidade só): horários são "floating local time".

const TZ = "America/Sao_Paulo";

/** Partes Y/M/D de um Date no fuso de Brasília. */
function partsBR(d: Date): { y: number; m: number; d: number } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // "YYYY-MM-DD"
  const [y, m, day] = f.split("-").map(Number);
  return { y, m, d: day };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Escapa texto pra um valor de propriedade ICS (RFC 5545). */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Dobra linhas longas em 75 octetos (RFC 5545) — simplificado por chars. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? "" : " ") + line.slice(i, i + 74));
    i += 74;
  }
  return out.join("\r\n");
}

export type IcsEvent = {
  uid: string;
  start: Date; // dia do evento (instante; só usamos a data em BR)
  startTime?: string | null; // "HH:mm"
  endTime?: string | null; // "HH:mm"
  summary: string;
  location?: string | null;
  description?: string | null;
};

/** Monta um documento VCALENDAR com os eventos (floating local time). */
export function buildIcs(calName: string, events: IcsEvent[], stampIso: string): string {
  const stamp = stampIso.replace(/[-:]/g, "").replace(/\.\d+/, ""); // 20260610T120000Z
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StageBoss//The Rock//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${esc(calName)}`),
    "X-WR-TIMEZONE:" + TZ,
  ];
  for (const ev of events) {
    const { y, m, d } = partsBR(ev.start);
    const ymd = `${y}${pad(m)}${pad(d)}`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (ev.startTime && /^\d{1,2}:\d{2}$/.test(ev.startTime)) {
      const [hh, mm] = ev.startTime.split(":").map(Number);
      lines.push(`DTSTART:${ymd}T${pad(hh)}${pad(mm)}00`);
      if (ev.endTime && /^\d{1,2}:\d{2}$/.test(ev.endTime)) {
        const [eh, em] = ev.endTime.split(":").map(Number);
        lines.push(`DTEND:${ymd}T${pad(eh)}${pad(em)}00`);
      }
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd}`);
    }
    lines.push(fold(`SUMMARY:${esc(ev.summary)}`));
    if (ev.location) lines.push(fold(`LOCATION:${esc(ev.location)}`));
    if (ev.description) lines.push(fold(`DESCRIPTION:${esc(ev.description)}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export type ParsedIcsEvent = {
  summary: string;
  location: string | null;
  description: string | null;
  start: Date | null; // instante calculado (meia-noite BR se all-day)
  startTime: string | null; // "HH:mm" se o evento tinha hora
  allDay: boolean;
};

/** Desdobra linhas continuadas (uma linha que começa com espaço/tab continua a anterior). */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unesc(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Converte um valor DTSTART/DTEND em {date, time, allDay}. */
function parseDt(value: string, hasDateOnly: boolean): { date: Date | null; time: string | null; allDay: boolean } {
  // value pode ser YYYYMMDD | YYYYMMDDTHHMMSS | YYYYMMDDTHHMMSSZ
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return { date: null, time: null, allDay: false };
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (hasDateOnly || !hh) {
    // all-day → meia-noite BR (usa UTC-3 fixo simplificado: 03:00Z ≈ 00:00 BRT)
    const date = new Date(Date.UTC(+y, +mo - 1, +d, 3, 0, 0));
    return { date, time: null, allDay: true };
  }
  const time = `${hh}:${mm}`;
  let date: Date;
  if (z) {
    date = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +(ss || "0")));
  } else {
    // floating/local → assume BR (UTC-3)
    date = new Date(Date.UTC(+y, +mo - 1, +d, +hh + 3, +mm, +(ss || "0")));
  }
  return { date, time, allDay: false };
}

/** Faz o parse de um texto .ics e devolve os VEVENTs encontrados. */
export function parseIcs(text: string): ParsedIcsEvent[] {
  const lines = unfold(text);
  const events: ParsedIcsEvent[] = [];
  let cur: Partial<ParsedIcsEvent> & { _dateOnly?: boolean } = {};
  let inEvent = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent) {
        events.push({
          summary: cur.summary || "(sem título)",
          location: cur.location ?? null,
          description: cur.description ?? null,
          start: cur.start ?? null,
          startTime: cur.startTime ?? null,
          allDay: cur.allDay ?? false,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    const ci = line.indexOf(":");
    if (ci < 0) continue;
    const left = line.slice(0, ci);
    const value = line.slice(ci + 1);
    const name = left.split(";")[0].toUpperCase();
    if (name === "SUMMARY") cur.summary = unesc(value);
    else if (name === "LOCATION") cur.location = unesc(value);
    else if (name === "DESCRIPTION") cur.description = unesc(value);
    else if (name === "DTSTART") {
      const dateOnly = /VALUE=DATE\b/i.test(left) && !/VALUE=DATE-TIME/i.test(left);
      const { date, time, allDay } = parseDt(value, dateOnly);
      cur.start = date;
      cur.startTime = time;
      cur.allDay = allDay;
    }
  }
  return events;
}
