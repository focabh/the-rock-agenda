import { db } from "@/db";
import {
  members,
  songs,
  venues,
  shows,
  setlists,
  setlistItems,
  rehearsals,
  showMemberPresence,
  rehearsalMemberPresence,
  bandPositions,
  appSettings,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";

/** Snapshot dos dados de PALCO da banda (JSON) pra leitura offline.
 *
 *  Qualquer músico logado pode baixar — é o pacote que alimenta repertório,
 *  letras, teleprompter, metrônomo, setlists e presença sem internet.
 *
 *  Princípios:
 *   - Só dados de palco/operacionais (sem financeiro, sem senhas/push).
 *   - Tira campos PESADOS (data URLs de foto/logo) — o app-shell já cacheia a
 *     logo como asset, e avatar não é essencial offline. Mantém o pacote leve.
 *   - `version` (epoch ms) deixa o cliente decidir se o cache local está velho.
 */
export async function GET() {
  await requireAuth();

  const [
    membersData,
    songsData,
    venuesData,
    showsData,
    setlistsData,
    setlistItemsData,
    rehearsalsData,
    showPresenceData,
    rehearsalPresenceData,
    positionsData,
    settingsData,
  ] = await Promise.all([
    db.select().from(members),
    db.select().from(songs),
    db.select().from(venues),
    db.select().from(shows),
    db.select().from(setlists),
    db.select().from(setlistItems),
    db.select().from(rehearsals),
    db.select().from(showMemberPresence),
    db.select().from(rehearsalMemberPresence),
    db.select().from(bandPositions),
    db.select().from(appSettings),
  ]);

  // Remove campos pesados (data URLs) pra não inchar o snapshot.
  const semCampos = <T extends Record<string, unknown>>(rows: T[], campos: string[]) =>
    rows.map((r) => {
      const c: Record<string, unknown> = { ...r };
      for (const k of campos) delete c[k];
      return c;
    });

  // VERSION = impressão digital do CONTEÚDO (não muda a cada request, só quando
  // algo de palco muda). Permite ao cliente saber se já baixou tudo e se há
  // conteúdo novo. Ignora presença (muda muito e não afeta o que se baixa).
  const stampOf = (rows: { updatedAt?: Date | null; createdAt?: Date | null }[]) =>
    rows.reduce((mx, r) => {
      const t = r.updatedAt ? +new Date(r.updatedAt) : r.createdAt ? +new Date(r.createdAt) : 0;
      return t > mx ? t : mx;
    }, 0);
  const maxUpdated = Math.max(
    stampOf(songsData),
    stampOf(setlistsData),
    stampOf(showsData),
    stampOf(rehearsalsData),
    stampOf(membersData),
    stampOf(venuesData),
    stampOf(positionsData),
    stampOf(settingsData)
  );
  const count =
    songsData.length +
    setlistsData.length +
    setlistItemsData.length +
    showsData.length +
    rehearsalsData.length +
    membersData.length +
    venuesData.length;
  const version = `${maxUpdated}.${count}`;

  const snapshot = {
    version,
    geradoEm: new Date().toISOString(),
    members: semCampos(membersData, ["avatar"]),
    songs: songsData,
    venues: semCampos(venuesData, ["logoUrl"]),
    shows: showsData,
    setlists: setlistsData,
    setlistItems: setlistItemsData,
    rehearsals: rehearsalsData,
    showMemberPresence: showPresenceData,
    rehearsalMemberPresence: rehearsalPresenceData,
    bandPositions: positionsData,
    appSettings: semCampos(settingsData, [
      "logoUrl",
      "backgroundUrl",
      "appBackgroundUrl",
    ]),
  };

  return new Response(JSON.stringify(snapshot), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
