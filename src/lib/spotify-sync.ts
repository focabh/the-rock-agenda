import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, songs } from "@/db/schema";
import {
  extractPlaylistId,
  fetchPlaylistTracks,
  SpotifyConfigError,
} from "@/lib/spotify";

export type SpotifyImportResult = {
  ok: boolean;
  error?: string;
  added?: number;
  existing?: number;
  total?: number;
};

/**
 * Importa/sincroniza uma playlist PÚBLICA do Spotify pro repertório: adiciona as
 * faixas que faltam e faz backfill (spotifyTrackId/duração) nas que já existem.
 * Dedupe por título+artista. **Nunca remove** — seguro contra apagar o que a
 * banda adicionou na mão. Sem auth aqui; quem chama é que controla (action/admin).
 */
export async function importPlaylistToRepertorio(
  playlistUrl: string
): Promise<SpotifyImportResult> {
  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) return { ok: false, error: "URL ou ID do Spotify inválido." };

  try {
    const tracks = await fetchPlaylistTracks(playlistId);
    const all = await db.select().from(songs);
    const byKey = new Map(
      all.map((s) => [`${s.titulo.toLowerCase()}|${s.artista.toLowerCase()}`, s])
    );

    let added = 0;
    let existing = 0;
    for (const t of tracks) {
      const key = `${t.titulo.toLowerCase()}|${t.artista.toLowerCase()}`;
      const found = byKey.get(key);
      if (found) {
        existing++;
        const patch: Record<string, string | number> = {};
        if (!found.spotifyTrackId && t.spotifyId) patch.spotifyTrackId = t.spotifyId;
        if (!found.duracaoSeg && t.duracaoSeg) patch.duracaoSeg = t.duracaoSeg;
        if (Object.keys(patch).length)
          await db.update(songs).set(patch).where(eq(songs.id, found.id));
        continue;
      }
      const [created] = await db
        .insert(songs)
        .values({
          titulo: t.titulo,
          artista: t.artista,
          status: "aprendendo",
          spotifyTrackId: t.spotifyId || null,
          duracaoSeg: t.duracaoSeg || null,
        })
        .returning();
      byKey.set(key, created);
      added++;
    }
    return { ok: true, added, existing, total: tracks.length };
  } catch (err) {
    const message =
      err instanceof SpotifyConfigError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Erro desconhecido ao importar.";
    return { ok: false, error: message };
  }
}

/** Sincroniza o repertório com a playlist CONFIGURADA (Conta › lista do repertório). */
export async function syncRepertorioFromConfiguredPlaylist(): Promise<SpotifyImportResult> {
  const [s] = await db.select().from(appSettings).limit(1);
  const url = s?.spotifyListRepertorio?.trim();
  if (!url) {
    return {
      ok: false,
      error:
        "Configure a playlist do repertório em Conta › Listas do Spotify primeiro.",
    };
  }
  return importPlaylistToRepertorio(url);
}
