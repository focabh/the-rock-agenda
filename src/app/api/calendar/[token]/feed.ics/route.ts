import { db } from "@/db";
import { shows, rehearsals, venues, appSettings } from "@/db/schema";
import { buildIcs, type IcsEvent } from "@/lib/ics";

/** Feed .ics PÚBLICO (acesso por token na URL) — pra assinar a agenda da banda
 *  no Google/Apple/Outlook. Mão única: reflete shows + ensaios e atualiza
 *  sozinho quando o calendário re-sincroniza. Sem login (calendários não
 *  autenticam); o token na URL é o segredo. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const [s] = await db.select().from(appSettings).limit(1);
  if (!s?.calendarToken || s.calendarToken !== token) {
    return new Response("Not found", { status: 404 });
  }

  const [showRows, rehRows, venueRows] = await Promise.all([
    db.select().from(shows),
    db.select().from(rehearsals),
    db.select().from(venues),
  ]);
  const venueName = new Map(venueRows.map((v) => [v.id, v.nome] as const));

  const events: IcsEvent[] = [];
  for (const sh of showRows) {
    if (sh.status === "cancelado") continue;
    const casa = venueName.get(sh.casaId) ?? "Show";
    events.push({
      uid: `show-${sh.id}@stageboss`,
      start: sh.data,
      startTime: sh.inicio,
      endTime: sh.termino,
      summary: `🎸 ${casa}`,
      location: [sh.endereco, sh.cidade, sh.estado].filter(Boolean).join(", ") || casa,
      description: sh.observacoes ?? null,
    });
  }
  for (const r of rehRows) {
    if (r.status === "cancelado") continue;
    events.push({
      uid: `ensaio-${r.id}@stageboss`,
      start: r.data,
      startTime: r.inicio,
      endTime: r.termino,
      summary: r.foco ? `🥁 Ensaio — ${r.foco.slice(0, 60)}` : "🥁 Ensaio",
      location: r.local || r.endereco || null,
      description: r.foco ?? null,
    });
  }

  const ics = buildIcs("The Rock — Agenda", events, new Date().toISOString());
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": 'inline; filename="the-rock.ics"',
    },
  });
}
