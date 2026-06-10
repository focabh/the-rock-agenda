"use server";

import { db } from "@/db";
import { shows, rehearsals, venues } from "@/db/schema";
import { requireCurrentUser, isAdmin } from "@/lib/auth";
import { parseIcs } from "@/lib/ics";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const u = await requireCurrentUser();
  if (!isAdmin(u)) throw new Error("Sem permissão.");
  return u;
}

export type ParsedEventDTO = {
  summary: string;
  location: string | null;
  description: string | null;
  startISO: string | null;
  startTime: string | null;
  allDay: boolean;
  suggested: "show" | "ensaio"; // palpite inicial
};

/** Busca (.ics por URL) ou recebe texto, faz o parse e devolve os eventos
 *  FUTUROS (não polui com histórico antigo). */
export async function fetchAndParseIcsAction(input: {
  url?: string;
  text?: string;
}): Promise<{ ok: true; events: ParsedEventDTO[] } | { ok: false; error: string }> {
  await requireAdmin();
  let text = input.text?.trim() || "";
  if (!text && input.url) {
    try {
      const u = input.url.trim().replace(/^webcal:/i, "https:");
      const res = await fetch(u, { redirect: "follow" });
      if (!res.ok) return { ok: false, error: `A URL respondeu ${res.status}.` };
      text = await res.text();
    } catch {
      return { ok: false, error: "Não consegui baixar a URL (verifique o link)." };
    }
  }
  if (!text.includes("BEGIN:VEVENT")) {
    return { ok: false, error: "Não encontrei eventos (.ics) aí." };
  }

  const now = Date.now();
  const events = parseIcs(text)
    .filter((e) => e.start && e.start.getTime() >= now - 36 * 3600 * 1000) // só futuros (margem 1.5d)
    .sort((a, b) => (a.start!.getTime() - b.start!.getTime()))
    .slice(0, 200)
    .map((e): ParsedEventDTO => {
      const s = (e.summary || "").toLowerCase();
      const suggested = /ensaio|rehearsal|passagem de som/.test(s) ? "ensaio" : "show";
      return {
        summary: e.summary,
        location: e.location,
        description: e.description,
        startISO: e.start ? e.start.toISOString() : null,
        startTime: e.startTime,
        allDay: e.allDay,
        suggested,
      };
    });

  return { ok: true, events };
}

export type ImportItem = {
  type: "show" | "ensaio" | "skip";
  summary: string;
  location: string | null;
  description: string | null;
  startISO: string;
  startTime: string | null;
};

/** Cria shows/ensaios a partir dos eventos escolhidos. Pra shows, casa o local
 *  com uma casa existente (nome, case-insensitive) ou cria uma nova. */
export async function importAgendaAction(
  items: ImportItem[]
): Promise<{ ok: true; shows: number; ensaios: number; casasCriadas: number } | { ok: false; error: string }> {
  await requireAdmin();

  const all = await db.select().from(venues);
  const byName = new Map(all.map((v) => [v.nome.trim().toLowerCase(), v.id] as const));

  let nShows = 0;
  let nEnsaios = 0;
  let nCasas = 0;

  for (const it of items) {
    if (it.type === "skip") continue;
    const data = new Date(it.startISO);
    if (Number.isNaN(data.getTime())) continue;

    if (it.type === "ensaio") {
      await db.insert(rehearsals).values({
        data,
        inicio: it.startTime ?? null,
        local: it.location ?? null,
        foco: it.summary || null,
        observacoes: it.description ?? null,
        status: "planejado",
      });
      nEnsaios++;
    } else {
      // show → resolve a casa
      const key = (it.location || it.summary || "").trim().toLowerCase();
      let casaId = key ? byName.get(key) : undefined;
      if (!casaId) {
        const nome = (it.location || it.summary || "Casa importada").slice(0, 120);
        const [v] = await db.insert(venues).values({ nome }).returning({ id: venues.id });
        casaId = v.id;
        byName.set(nome.trim().toLowerCase(), v.id);
        nCasas++;
      }
      await db.insert(shows).values({
        casaId,
        data,
        inicio: it.startTime ?? null,
        observacoes: it.description ?? null,
        status: "planejado",
      });
      nShows++;
    }
  }

  revalidatePath("/agenda");
  revalidatePath("/shows");
  revalidatePath("/ensaios");
  return { ok: true, shows: nShows, ensaios: nEnsaios, casasCriadas: nCasas };
}
