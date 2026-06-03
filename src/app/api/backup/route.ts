import { db } from "@/db";
import {
  members,
  songs,
  venues,
  shows,
  setlists,
  setlistItems,
  rehearsals,
  gastos,
  reembolsos,
  showMemberPayment,
  showSubstitute,
  appSettings,
} from "@/db/schema";
import { requireSuperuser } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";

/** Backup completo dos dados operacionais da banda (JSON), pro superusuário.
 *  Não inclui dados sensíveis de login (senhas, push) nem comprovantes (pesados).
 */
export async function GET() {
  await requireSuperuser();

  const [
    membersData,
    songsData,
    venuesData,
    showsData,
    setlistsData,
    setlistItemsData,
    rehearsalsData,
    gastosData,
    reembolsosData,
    paymentsData,
    subsData,
    settingsData,
  ] = await Promise.all([
    db.select().from(members),
    db.select().from(songs),
    db.select().from(venues),
    db.select().from(shows),
    db.select().from(setlists),
    db.select().from(setlistItems),
    db.select().from(rehearsals),
    db.select().from(gastos),
    db.select().from(reembolsos),
    db.select().from(showMemberPayment),
    db.select().from(showSubstitute),
    db.select().from(appSettings),
  ]);

  // Tira campos pesados (data URLs de comprovante) pra não inchar o arquivo.
  const semComprovante = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((r) => {
      const c: Record<string, unknown> = { ...r };
      delete c.comprovante;
      return c;
    });

  const dump = {
    geradoEm: new Date().toISOString(),
    app: "StageBoss",
    contagens: {
      membros: membersData.length,
      musicas: songsData.length,
      casas: venuesData.length,
      shows: showsData.length,
      ensaios: rehearsalsData.length,
    },
    members: membersData,
    songs: songsData,
    venues: venuesData,
    shows: showsData,
    setlists: setlistsData,
    setlistItems: setlistItemsData,
    rehearsals: rehearsalsData,
    gastos: semComprovante(gastosData),
    reembolsos: semComprovante(reembolsosData),
    showMemberPayment: paymentsData,
    showSubstitute: subsData,
    appSettings: settingsData,
  };

  const hoje = formatDataBR(new Date()).replace(/\//g, "-");
  return new Response(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="stageboss-backup-${hoje}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
