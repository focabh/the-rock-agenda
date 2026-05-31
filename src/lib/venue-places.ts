// Enriquecimento de perfil de casa SEM explodir tokens: busca dados concretos
// no Google Places (crédito gratuito do Google), filtra LOCALMENTE por regex as
// frases que importam (som/banda/rock/público...) e só então manda um bloco
// enxuto pra IA devolver 3 palavras-chave. Nunca manda payload bruto pra IA.

import { NoApiKeyError } from "@/lib/venue-ai";

const MODEL = "claude-haiku-4-5-20251001";

// Palavras-chave de interesse (perfil musical/som/público) — filtro local.
const INTERESSE =
  /\b(som|banda|m[uú]sic|rock|barulh|ac[uú]stic|pista|ao vivo|palco|show|cover|sertanej|pagode|dj|p[uú]blico|ambiente|cerveja|happy ?hour|jovem|galera|lotad|voz|cantor)/i;

export type PlaceProfile = {
  found: boolean;
  categoria: string;
  resumoLimpo: string; // frases relevantes já filtradas
};

/** Busca a casa no Google Places e devolve categoria + frases relevantes das
 *  reviews/summary (já filtradas localmente). Custo: crédito do Google (R$0). */
export async function fetchPlaceProfile(
  nome: string,
  cidade?: string | null
): Promise<PlaceProfile> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { found: false, categoria: "", resumoLimpo: "" };

  const textQuery = [nome, cidade].filter(Boolean).join(", ");
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.primaryTypeDisplayName,places.editorialSummary,places.reviews",
      },
      body: JSON.stringify({ textQuery, languageCode: "pt-BR", maxResultCount: 1 }),
    });
    const data = (await r.json()) as {
      places?: {
        primaryTypeDisplayName?: { text?: string };
        editorialSummary?: { text?: string };
        reviews?: { text?: { text?: string }; originalText?: { text?: string } }[];
      }[];
    };
    const p = data.places?.[0];
    if (!p) return { found: false, categoria: "", resumoLimpo: "" };

    const categoria = p.primaryTypeDisplayName?.text ?? "";
    const bruto = [
      p.editorialSummary?.text ?? "",
      ...(p.reviews ?? [])
        .slice(0, 5)
        .map((rv) => rv.text?.text ?? rv.originalText?.text ?? ""),
    ].join(" \n ");

    // Filtro LOCAL: só frases que tocam nos temas de interesse.
    const frases = bruto
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8 && INTERESSE.test(s));
    const resumoLimpo = [...new Set(frases)].slice(0, 12).join(" ").slice(0, 1200);

    return { found: true, categoria, resumoLimpo };
  } catch {
    return { found: false, categoria: "", resumoLimpo: "" };
  }
}

/** Extrai "@handle" de uma URL de instagram, se for o caso. */
export function instagramFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (!m) return null;
  const h = m[1].replace(/\/$/, "");
  if (!h || /^(p|reel|explore|accounts)$/i.test(h)) return null;
  return `@${h}`;
}

/** Busca o site oficial da casa no Google Places (pra extrair o Instagram). */
export async function fetchPlaceWebsite(
  nome: string,
  cidade?: string | null
): Promise<string | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.websiteUri,places.displayName",
      },
      body: JSON.stringify({ textQuery: [nome, cidade].filter(Boolean).join(", "), languageCode: "pt-BR", maxResultCount: 1 }),
    });
    const data = (await r.json()) as { places?: { websiteUri?: string }[] };
    return data.places?.[0]?.websiteUri ?? null;
  } catch {
    return null;
  }
}

export type CasaCandidata = {
  nome: string;
  endereco: string;
  lat: number | null;
  lng: number | null;
  categoria: string;
  website: string | null;
  instagram: string | null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Descobre casas perto (lat/lng + raio) que batem com o termo do perfil da
 *  banda (ex.: "bar música ao vivo rock pub"). Custo: Google Places (crédito). */
export async function descobrirCasas(params: {
  lat: number;
  lng: number;
  raioM: number;
  termo: string;
}): Promise<CasaCandidata[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];
  const { lat, lng, raioM, termo } = params;
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.websiteUri,places.primaryTypeDisplayName",
      },
      body: JSON.stringify({
        textQuery: termo,
        languageCode: "pt-BR",
        maxResultCount: 20,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(50000, Math.max(500, raioM)) } },
      }),
    });
    const data = (await r.json()) as {
      places?: {
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        websiteUri?: string;
        primaryTypeDisplayName?: { text?: string };
      }[];
    };
    const raioKm = raioM / 1000;
    return (data.places ?? [])
      .map((p) => {
        const plat = p.location?.latitude ?? null;
        const plng = p.location?.longitude ?? null;
        return {
          nome: p.displayName?.text ?? "",
          endereco: p.formattedAddress ?? "",
          lat: plat,
          lng: plng,
          categoria: p.primaryTypeDisplayName?.text ?? "",
          website: p.websiteUri ?? null,
          instagram: instagramFromUrl(p.websiteUri),
        };
      })
      .filter((c) => c.nome)
      // dentro do raio (o locationBias é só "viés" — filtramos de fato)
      .filter((c) => c.lat == null || c.lng == null || haversineKm({ lat, lng }, { lat: c.lat, lng: c.lng }) <= raioKm * 1.2);
  } catch {
    return [];
  }
}

/** Manda o bloco JÁ ENXUTO pra IA e recebe só 3 palavras-chave + 1 frase. */
export async function keywordsFromPlace(input: {
  nome: string;
  categoria: string;
  resumoLimpo: string;
  instagram?: string | null;
}): Promise<{ caracteristicas: string[]; perfilPublico: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");

  const prompt = `Casa de show: "${input.nome}". Categoria Google: ${input.categoria || "?"}.${input.instagram ? ` Instagram: ${input.instagram}.` : ""}
Trechos REAIS de avaliações (já filtrados):
"""${input.resumoLimpo || "(sem trechos relevantes)"}"""

Resuma o PERFIL da casa pra uma banda cover de rock decidir se toca lá.
Responda SÓ com JSON, sem texto fora: {"perfil":["3 palavras-chave"],"frase":"1 frase curta sobre o público"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 250,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok)
    throw new Error(`Anthropic falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("IA não devolveu JSON.");
  const parsed = JSON.parse(m[0]) as { perfil?: unknown; frase?: unknown };
  const caracteristicas = Array.isArray(parsed.perfil)
    ? parsed.perfil.filter((x) => typeof x === "string").slice(0, 3)
    : [];
  const perfilPublico =
    typeof parsed.frase === "string" ? parsed.frase.slice(0, 300) : "";
  return { caracteristicas, perfilPublico };
}
