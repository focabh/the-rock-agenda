/**
 * Spotify Web API — fluxo OAuth Authorization Code.
 * O admin conecta a conta Spotify uma vez, guardamos o refresh_token.
 *
 * Setup:
 *   1. Criar app em https://developer.spotify.com/dashboard
 *   2. Adicionar Redirect URI exatamente igual ao SPOTIFY_REDIRECT_URI do .env.local
 *   3. SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI no .env.local
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { spotifyAuth } from "@/db/schema";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const AUTH_URL = "https://accounts.spotify.com/authorize";
const API_BASE = "https://api.spotify.com/v1";

const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  // escrita: criar/editar playlists PÚBLICAS na conta conectada (exportar)
  "playlist-modify-public",
];

/** Escopo que habilita exportar (criar playlist). */
const EXPORT_SCOPE = "playlist-modify-public";

export class SpotifyConfigError extends Error {}
export class SpotifyNotConnectedError extends Error {}

function getClientCreds() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!id || !secret || !redirectUri) {
    throw new SpotifyConfigError(
      "Spotify não configurado. Defina SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e SPOTIFY_REDIRECT_URI no .env.local"
    );
  }
  return { id, secret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string {
  const { id, redirectUri } = getClientCreds();
  const params = new URLSearchParams({
    client_id: id,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
    show_dialog: "false",
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  expires_in: number;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { id, secret, redirectUri } = getClientCreds();
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify exchangeCode falhou (${res.status}): ${text}`);
  }
  return res.json();
}

export async function isSpotifyConnected(): Promise<{
  connected: boolean;
  ownerName?: string | null;
  /** A conexão atual tem escopo pra EXPORTAR (criar playlist)? Conexões antigas
   *  (read-only) não têm — o usuário precisa reconectar. */
  canExport: boolean;
}> {
  const [auth] = await db.select().from(spotifyAuth).limit(1);
  return {
    connected: !!auth,
    ownerName: auth?.ownerDisplayName ?? null,
    canExport: !!auth?.scope && auth.scope.includes(EXPORT_SCOPE),
  };
}

export type ExportResult =
  | { ok: true; url: string; count: number }
  | { ok: false; error: string; needsReconnect?: boolean };

/** Cria uma playlist PÚBLICA na conta conectada e adiciona as faixas. */
export async function exportTracksToPlaylist(opts: {
  name: string;
  description?: string;
  trackIds: string[];
}): Promise<ExportResult> {
  const { name, description, trackIds } = opts;
  if (trackIds.length === 0) {
    return { ok: false, error: "Nenhuma música com faixa do Spotify pra exportar." };
  }
  const token = await getValidAccessToken();
  if (!token) return { ok: false, error: "Spotify não conectado.", needsReconnect: true };

  const meRes = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!meRes.ok) {
    return {
      ok: false,
      error: `Spotify recusou (${meRes.status}). Tente reconectar.`,
      needsReconnect: meRes.status === 401 || meRes.status === 403,
    };
  }
  const me = (await meRes.json()) as { id?: string };
  if (!me.id) return { ok: false, error: "Não consegui identificar a conta Spotify." };

  const createRes = await fetch(`${API_BASE}/users/${me.id}/playlists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description ?? "", public: true }),
  });
  if (!createRes.ok) {
    const insufficient = createRes.status === 401 || createRes.status === 403;
    return {
      ok: false,
      error: insufficient
        ? "O Spotify não autorizou criar a playlist. Reconecte o Spotify (pra dar a permissão de escrita) — e, se persistir, sua conta precisa estar no allowlist do app no Spotify Dashboard."
        : `Não consegui criar a playlist (${createRes.status}).`,
      needsReconnect: insufficient,
    };
  }
  const pl = (await createRes.json()) as { id: string; external_urls?: { spotify?: string } };

  const uris = trackIds.map((id) => `spotify:track:${id}`);
  for (let i = 0; i < uris.length; i += 100) {
    const addRes = await fetch(`${API_BASE}/playlists/${pl.id}/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
    if (!addRes.ok) {
      return {
        ok: false,
        error: `Playlist criada, mas falhou ao adicionar as faixas (${addRes.status}).`,
      };
    }
  }
  return {
    ok: true,
    url: pl.external_urls?.spotify ?? `https://open.spotify.com/playlist/${pl.id}`,
    count: trackIds.length,
  };
}

export async function saveSpotifyTokens(tokens: TokenResponse): Promise<void> {
  if (!tokens.refresh_token) {
    throw new Error("Spotify não retornou refresh_token.");
  }

  // Buscar nome do dono pra mostrar na UI
  let ownerDisplayName: string | null = null;
  try {
    const me = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (me.ok) {
      const data = (await me.json()) as { display_name?: string; id?: string };
      ownerDisplayName = data.display_name ?? data.id ?? null;
    }
  } catch {
    // ignora
  }

  const existing = await db.select().from(spotifyAuth).limit(1);
  if (existing[0]) {
    await db
      .update(spotifyAuth)
      .set({
        refreshToken: tokens.refresh_token,
        scope: tokens.scope ?? null,
        ownerDisplayName,
      })
      .where(eq(spotifyAuth.id, existing[0].id));
  } else {
    await db.insert(spotifyAuth).values({
      refreshToken: tokens.refresh_token,
      scope: tokens.scope ?? null,
      ownerDisplayName,
    });
  }
}

export async function disconnectSpotify(): Promise<void> {
  await db.delete(spotifyAuth);
}

/** Troca o refresh_token guardado por um access_token válido (ou null). */
async function getValidAccessToken(): Promise<string | null> {
  const [auth] = await db.select().from(spotifyAuth).limit(1);
  if (!auth?.refreshToken) return null;
  try {
    const { id, secret } = getClientCreds();
    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Popularidade (0–100) por faixa via GET /v1/tracks (lotes de 50), usando o
 * token OAuth do admin. Retorna mapa spotifyId→popularidade. Mapa vazio se a
 * conexão falhar ou o app estiver restrito (dev-mode 403).
 */
export async function fetchTracksPopularity(
  ids: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const token = await getValidAccessToken();
  if (!token) return out;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await fetch(`${API_BASE}/tracks?ids=${batch.join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break; // 403 (dev-mode) ou erro → para e devolve o que tiver
    const data = (await res.json()) as {
      tracks?: { id?: string; popularity?: number }[];
    };
    for (const t of data.tracks ?? []) {
      if (t?.id && typeof t.popularity === "number") out.set(t.id, t.popularity);
    }
  }
  return out;
}

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/playlist[/:]([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/** Aceita link/URI de FAIXA do Spotify (ou o ID de 22 chars cru). */
export function extractTrackId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/track[/:]([a-zA-Z0-9]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

export type SpotifyTrack = {
  spotifyId: string;
  titulo: string;
  artista: string;
  duracaoSeg: number;
};

const TRACK_URI_PREFIX = "spotify:track:";

type EmbedTrack = {
  uri?: string;
  uid?: string;
  title?: string;
  subtitle?: string;
  artists?: { name?: string }[];
  duration?: number;
};

// Busca recursiva por um objeto de FAIXA única (tem title + uri spotify:track)
// no JSON do embed de uma faixa.
function findTrackEntity(node: unknown): EmbedTrack | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const uri = typeof obj.uri === "string" ? obj.uri : "";
  if (
    typeof obj.title === "string" &&
    (uri.startsWith(TRACK_URI_PREFIX) || typeof obj.subtitle === "string")
  ) {
    return obj as EmbedTrack;
  }
  for (const value of Object.values(obj)) {
    const found = findTrackEntity(value);
    if (found) return found;
  }
  return null;
}

/**
 * Lê UMA faixa pública pela página de embed (open.spotify.com/embed/track/{id}),
 * mesma técnica da playlist. Retorna null se não conseguir ler.
 */
export async function fetchTrack(trackId: string): Promise<SpotifyTrack | null> {
  const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TheRock/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match) return null;
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  const t = findTrackEntity(data);
  if (!t?.title) return null;
  const uri = typeof t.uri === "string" ? t.uri : "";
  const spotifyId = uri.startsWith(TRACK_URI_PREFIX)
    ? uri.slice(TRACK_URI_PREFIX.length)
    : trackId;
  const artista =
    (Array.isArray(t.artists)
      ? t.artists
          .map((a) => a?.name?.trim())
          .filter(Boolean)
          .join(", ")
      : "") ||
    t.subtitle?.trim() ||
    "Desconhecido";
  return {
    spotifyId,
    titulo: t.title,
    artista,
    duracaoSeg: Math.round((t.duration ?? 0) / 1000),
  };
}

// Busca recursiva por um array `trackList` em qualquer profundidade do JSON
// do __NEXT_DATA__ (o caminho exato pode mudar entre versões da página).
function findTrackList(node: unknown): EmbedTrack[] | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.trackList)) return obj.trackList as EmbedTrack[];
  for (const value of Object.values(obj)) {
    const found = findTrackList(value);
    if (found) return found;
  }
  return null;
}

/**
 * Lê as faixas de uma playlist PÚBLICA pela página de embed do Spotify
 * (open.spotify.com/embed/playlist/{id}), que expõe a tracklist no
 * <script id="__NEXT_DATA__">.
 *
 * NÃO usa a Web API oficial: o endpoint GET /playlists/{id}/tracks foi
 * bloqueado para apps em Development Mode (retorna 403 mesmo com client
 * credentials, desde a mudança de nov/2024). O embed público não tem essa
 * restrição. Playlists privadas não aparecem aqui — nesse caso, "Colar lista".
 */
export async function fetchPlaylistTracks(
  playlistId: string
): Promise<SpotifyTrack[]> {
  const res = await fetch(
    `https://open.spotify.com/embed/playlist/${playlistId}`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TheRock/1.0)" },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("Playlist não encontrada.");
    throw new Error(`Erro ao buscar playlist (${res.status}).`);
  }

  const html = await res.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match) {
    throw new Error(
      "Não consegui ler a playlist. Confirme que ela é pública — se for privada, use a aba “Colar lista”."
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("Resposta inesperada do Spotify. Use a aba “Colar lista”.");
  }

  const list = findTrackList(data);
  if (!list || list.length === 0) {
    throw new Error(
      "Nenhuma faixa encontrada. A playlist pode estar vazia ou ser privada — use a aba “Colar lista”."
    );
  }

  const tracks: SpotifyTrack[] = [];
  for (const t of list) {
    if (!t?.title) continue;
    const uri = typeof t.uri === "string" ? t.uri : "";
    const spotifyId = uri.startsWith(TRACK_URI_PREFIX)
      ? uri.slice(TRACK_URI_PREFIX.length)
      : (t.uid ?? "");
    tracks.push({
      spotifyId,
      titulo: t.title,
      artista: t.subtitle?.trim() || "Desconhecido",
      duracaoSeg: Math.round((t.duration ?? 0) / 1000),
    });
  }
  return tracks;
}
