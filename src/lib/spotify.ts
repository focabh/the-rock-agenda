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

const SCOPES = ["playlist-read-private", "playlist-read-collaborative"];

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

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
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
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify refresh falhou (${res.status}): ${text}`);
  }
  return res.json();
}

async function getAccessToken(): Promise<string> {
  const [auth] = await db.select().from(spotifyAuth).limit(1);
  if (!auth) {
    throw new SpotifyNotConnectedError(
      "Conta Spotify não conectada. Vá em Repertório → Conectar Spotify."
    );
  }
  const tokens = await refreshAccessToken(auth.refreshToken);
  // Spotify pode emitir um novo refresh_token — guardar se vier
  if (tokens.refresh_token && tokens.refresh_token !== auth.refreshToken) {
    await db
      .update(spotifyAuth)
      .set({ refreshToken: tokens.refresh_token })
      .where(eq(spotifyAuth.id, auth.id));
  }
  return tokens.access_token;
}

export async function isSpotifyConnected(): Promise<{
  connected: boolean;
  ownerName?: string | null;
}> {
  const [auth] = await db.select().from(spotifyAuth).limit(1);
  return {
    connected: !!auth,
    ownerName: auth?.ownerDisplayName ?? null,
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

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/playlist[/:]([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export type SpotifyTrack = {
  spotifyId: string;
  titulo: string;
  artista: string;
  duracaoSeg: number;
};

type SpotifyPlaylistResponse = {
  next: string | null;
  items: Array<{
    track: {
      id: string | null;
      name: string;
      duration_ms: number;
      artists: Array<{ name: string }>;
    } | null;
  }>;
};

export async function fetchPlaylistTracks(
  playlistId: string
): Promise<SpotifyTrack[]> {
  const token = await getAccessToken();
  const tracks: SpotifyTrack[] = [];
  let url: string | null =
    `${API_BASE}/playlists/${playlistId}/tracks?market=BR&limit=100`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("Playlist não encontrada.");
      }
      if (res.status === 403) {
        throw new Error(
          "Spotify negou acesso. Verifique se a conta conectada tem acesso a essa playlist."
        );
      }
      throw new Error(`Erro ao buscar playlist (${res.status})`);
    }
    const data = (await res.json()) as SpotifyPlaylistResponse;
    for (const item of data.items ?? []) {
      const t = item?.track;
      if (!t || !t.id) continue;
      tracks.push({
        spotifyId: t.id,
        titulo: t.name,
        artista: t.artists?.[0]?.name ?? "Desconhecido",
        duracaoSeg: Math.round((t.duration_ms ?? 0) / 1000),
      });
    }
    url = data.next;
  }
  return tracks;
}
