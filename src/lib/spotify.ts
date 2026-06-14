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
  // escrita: criar/editar playlists na conta conectada (exportar)
  "playlist-modify-public",
  "playlist-modify-private",
  // leitura da conta: deixa o diagnóstico mostrar o EMAIL exato (pra liberar no
  // User Management) e o produto (grátis/premium). Não afeta o export.
  "user-read-private",
  "user-read-email",
];

/** Escopo que habilita exportar (criar playlist).
 *  Criamos a playlist como PRIVADA (public:false) — em Development Mode o
 *  Spotify bloqueia criar playlist PÚBLICA via API (403 Forbidden). Privada
 *  ainda é acessível por link compartilhado. Por isso exige modify-private. */
const EXPORT_SCOPE = "playlist-modify-private";

export class SpotifyConfigError extends Error {}
export class SpotifyNotConnectedError extends Error {}

/** Extrai a mensagem de erro do corpo JSON do Spotify, como `: <msg>` (ou ""). */
function spotifyDetail(body: string): string {
  try {
    const msg = (JSON.parse(body) as { error?: { message?: string } })?.error
      ?.message;
    return msg ? `: ${msg}` : "";
  } catch {
    return "";
  }
}

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
    // true: sempre mostra o consentimento. Garante que, ao reconectar, o
    // usuário veja e conceda a permissão de escrita (playlist-modify-public),
    // mesmo que o app já tivesse sido autorizado antes só com leitura.
    show_dialog: "true",
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

export type SpotifyDiagnosis = {
  configured: boolean;
  connected: boolean;
  savedScope: string | null;
  hasExportScope: boolean;
  account?: {
    id: string;
    displayName: string | null;
    email: string | null;
    product: string | null; // "premium" | "free" | ...
    country: string | null;
  };
  createTest?: { ok: boolean; status: number; detail: string };
  verdict: string;
};

/**
 * Diagnóstico de ponta a ponta do export: mostra o escopo salvo, os dados REAIS
 * da conta conectada (email exato, produto) e TENTA criar uma playlist de teste,
 * devolvendo o erro real do Spotify. A playlist de teste é removida (unfollow)
 * em seguida. Serve pra parar de adivinhar por que o 403 acontece.
 */
export async function spotifyDiagnose(): Promise<SpotifyDiagnosis> {
  try {
    getClientCreds();
  } catch {
    return {
      configured: false,
      connected: false,
      savedScope: null,
      hasExportScope: false,
      verdict:
        "Spotify não configurado (faltam SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI).",
    };
  }

  const [auth] = await db.select().from(spotifyAuth).limit(1);
  const savedScope = auth?.scope ?? null;
  const hasExportScope = !!savedScope && savedScope.includes(EXPORT_SCOPE);
  if (!auth) {
    return {
      configured: true,
      connected: false,
      savedScope: null,
      hasExportScope: false,
      verdict: "Spotify não conectado. Clique em Conectar.",
    };
  }

  const token = await getValidAccessToken();
  if (!token) {
    return {
      configured: true,
      connected: true,
      savedScope,
      hasExportScope,
      verdict: "Não consegui renovar o token de acesso. Reconecte o Spotify.",
    };
  }

  // Dados reais da conta
  const meRes = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBody = await meRes.text().catch(() => "");
  if (!meRes.ok) {
    return {
      configured: true,
      connected: true,
      savedScope,
      hasExportScope,
      verdict: `Falha ao ler a conta (/me ${meRes.status}${spotifyDetail(
        meBody
      )}). Reconecte.`,
    };
  }
  const me = JSON.parse(meBody) as {
    id: string;
    display_name?: string;
    email?: string;
    product?: string;
    country?: string;
  };
  const account = {
    id: me.id,
    displayName: me.display_name ?? null,
    email: me.email ?? null,
    product: me.product ?? null,
    country: me.country ?? null,
  };

  // Tenta criar uma playlist de teste (mesma chamada do export) pra capturar o erro real.
  const createRes = await fetch(`${API_BASE}/users/${me.id}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "The Rock — teste de diagnóstico (pode apagar)",
      description: "Teste do StageBoss. Pode remover.",
      public: false,
    }),
  });
  const createBody = await createRes.text().catch(() => "");
  const createTest = {
    ok: createRes.ok,
    status: createRes.status,
    detail: spotifyDetail(createBody) || createBody.slice(0, 200),
  };

  // Limpa o teste: no Spotify "apagar" playlist = deixar de seguir.
  if (createRes.ok) {
    try {
      const pl = JSON.parse(createBody) as { id?: string };
      if (pl.id) {
        await fetch(`${API_BASE}/playlists/${pl.id}/followers`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignora — só limpeza
    }
  }

  // Veredito
  const emailRef = account.email
    ? `"${account.email}"`
    : `(id ${account.id} — reconecte pra ver o email exato)`;
  let verdict: string;
  if (createTest.ok) {
    verdict = "✅ Criar playlist FUNCIONA agora. Tente exportar de novo.";
  } else if (createTest.status === 401) {
    verdict = "Token inválido/expirado — reconecte o Spotify.";
  } else if (createTest.status === 403) {
    verdict =
      `❌ 403 ao criar playlist. A conta ${emailRef} NÃO está liberada no app. ` +
      `Vá em developer.spotify.com → app → User Management e adicione ESTE email exato` +
      (account.email ? "" : " (reconecte primeiro pra descobri-lo)") +
      `. Produto: ${account.product ?? "?"}.`;
  } else {
    verdict = `Falhou ao criar a playlist (${createTest.status}${
      createTest.detail ? `: ${createTest.detail}` : ""
    }).`;
  }
  if (!hasExportScope) {
    verdict =
      `⚠️ O token salvo NÃO tem o escopo de escrita (${EXPORT_SCOPE}) — reconecte e aceite as permissões. ` +
      verdict;
  }

  return {
    configured: true,
    connected: true,
    savedScope,
    hasExportScope,
    account,
    createTest,
    verdict,
  };
}

export type ExportResult =
  | { ok: true; url: string; count: number }
  | { ok: false; error: string; needsReconnect?: boolean };

/** Cria uma playlist (privada, mas link-compartilhável) na conta conectada e
 *  adiciona as faixas. Privada porque o dev mode do Spotify barra criar
 *  pública via API. */
export async function exportTracksToPlaylist(opts: {
  name: string;
  description?: string;
  trackIds: string[];
}): Promise<ExportResult> {
  const { name, description, trackIds } = opts;
  if (trackIds.length === 0) {
    return { ok: false, error: "Nenhuma música com faixa do Spotify pra exportar." };
  }
  // Guard cedo: se a conexão salva claramente não tem escopo de escrita,
  // nem tenta a API — manda reconectar direto.
  const [auth] = await db.select().from(spotifyAuth).limit(1);
  if (auth?.scope && !auth.scope.includes(EXPORT_SCOPE)) {
    return {
      ok: false,
      needsReconnect: true,
      error:
        "A conexão atual do Spotify é só de leitura (sem permissão pra criar playlist). Clique em Reconectar e aceite as permissões.",
    };
  }

  const token = await getValidAccessToken();
  if (!token) return { ok: false, error: "Spotify não conectado.", needsReconnect: true };

  const meRes = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!meRes.ok) {
    const body = await meRes.text().catch(() => "");
    console.error("Spotify /me falhou:", meRes.status, body);
    return {
      ok: false,
      error: `Spotify recusou ao ler sua conta (${meRes.status}${spotifyDetail(body)}). Tente reconectar.`,
      needsReconnect: meRes.status === 401 || meRes.status === 403,
    };
  }
  const me = (await meRes.json()) as { id?: string };
  if (!me.id) return { ok: false, error: "Não consegui identificar a conta Spotify." };

  const createRes = await fetch(`${API_BASE}/users/${me.id}/playlists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description ?? "", public: false }),
  });
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => "");
    // Loga o corpo completo no servidor pra diagnóstico (Vercel logs).
    console.error("Spotify criar playlist falhou:", createRes.status, body);
    const detail = spotifyDetail(body);
    const insufficient = createRes.status === 401 || createRes.status === 403;
    return {
      ok: false,
      error: insufficient
        ? `O Spotify recusou criar a playlist (${createRes.status}${detail}). ` +
          `Se a mensagem fala de "scope", clique em Reconectar e aceite as permissões. ` +
          `Se fala "not registered"/Developer Dashboard, a conta precisa estar no allowlist do app (Dashboard › User Management).`
        : `Não consegui criar a playlist (${createRes.status}${detail}).`,
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
