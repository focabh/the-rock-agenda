import "server-only";
import { and, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { shows, rehearsals, announcements } from "@/db/schema";
import { getBrand } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";
import { brDateKey } from "@/lib/conflicts";

export type Alternativa = {
  data: string; // YYYY-MM-DD
  periodo: "manha" | "tarde" | "noite" | "custom";
  horaInicio?: string;
  horaFim?: string;
};

export type ConflictInfo = {
  has: boolean;
  label: string; // ex.: "Show no Porks (26/06) e Ensaio (13/06)"
  count: number;
};

/** Eventos (shows/ensaios não cancelados) que caem no período da indisponibilidade. */
export async function detectConflicts(dataInicio: Date, dataFim: Date): Promise<ConflictInfo> {
  const win = (d: Date, deltaDays: number, h: number) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + deltaDays);
    x.setUTCHours(h, 0, 0, 0);
    return x;
  };
  const winStart = win(dataInicio, -1, 0);
  const winEnd = win(dataFim, 1, 23);

  const [showRows, rehRows] = await Promise.all([
    db.query.shows.findMany({
      where: and(gte(shows.data, winStart), lte(shows.data, winEnd)),
      with: { casa: { columns: { nome: true } } },
    }),
    db.select().from(rehearsals).where(and(gte(rehearsals.data, winStart), lte(rehearsals.data, winEnd))),
  ]);

  const startKey = brDateKey(dataInicio);
  const endKey = brDateKey(dataFim);
  const inRange = (d: Date) => {
    const k = brDateKey(d);
    return k >= startKey && k <= endKey;
  };

  const cShows = showRows.filter((s) => s.status !== "cancelado" && inRange(s.data));
  const cEns = rehRows.filter((r) => r.status !== "cancelado" && inRange(r.data));

  const parts = [
    ...cShows.map((s) => `Show no ${s.casa.nome} (${formatDataBR(s.data)})`),
    ...cEns.map((r) => `Ensaio (${formatDataBR(r.data)})`),
  ];
  return { has: parts.length > 0, label: parts.join(" e "), count: parts.length };
}

function periodoTxt(a: Alternativa): string {
  if (a.periodo === "custom" && a.horaInicio && a.horaFim) return `${a.horaInicio}–${a.horaFim}`;
  return { manha: "manhã", tarde: "tarde", noite: "noite", custom: "horário a combinar" }[a.periodo];
}

function alternativasTxt(alts: Alternativa[]): string {
  return alts
    .map((a) => {
      const [y, m, d] = a.data.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12));
      return `• ${formatDataBR(dt)} (${periodoTxt(a)})`;
    })
    .join("\n");
}

/** Cria aviso no mural + devolve o texto/grupo pra WhatsApp (push está suspenso). */
export async function announceUnavailabilityConflict(opts: {
  nome: string;
  conflict: ConflictInfo;
  alternativas: Alternativa[];
  motivo?: string | null;
  createdById?: string | null;
}): Promise<{ whatsappText: string; groupLink: string | null }> {
  const { nome, conflict, alternativas, motivo, createdById } = opts;
  const titulo = `⚠️ Conflito de agenda — ${nome} indisponível`;
  const corpo =
    `${nome} marcou indisponibilidade que afeta: ${conflict.label}.` +
    (motivo ? ` Motivo: ${motivo}.` : "") +
    `\nO evento precisa ser reagendado ou revisto.\n\n` +
    `Disponibilidade sugerida por ${nome}:\n${alternativasTxt(alternativas)}`;

  await db.insert(announcements).values({ titulo, corpo, createdById: createdById ?? null });

  const brand = await getBrand();
  const whatsappText = `⚠️ Conflito de agenda\n${corpo}`;
  return { whatsappText, groupLink: brand.whatsappGrupo || null };
}

/** Reverso: pessoa voltou a ficar disponível onde havia conflito. */
export async function announceAvailabilityRestored(opts: {
  nome: string;
  conflict: ConflictInfo;
  createdById?: string | null;
}): Promise<{ whatsappText: string; groupLink: string | null }> {
  const { nome, conflict, createdById } = opts;
  const titulo = `✅ ${nome} voltou a ficar disponível`;
  const corpo = `${nome} desmarcou a indisponibilidade que afetava: ${conflict.label}. O evento pode ser confirmado/mantido.`;
  await db.insert(announcements).values({ titulo, corpo, createdById: createdById ?? null });
  const brand = await getBrand();
  return { whatsappText: `✅ ${corpo}`, groupLink: brand.whatsappGrupo || null };
}
