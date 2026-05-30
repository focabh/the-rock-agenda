// Enriquecimento do perfil da casa via Claude (Anthropic). Usa web search pra
// tentar achar o Instagram/reputação da casa e sugerir público/estilo/tags.
// Sem ANTHROPIC_API_KEY configurada, lança erro amigável (a UI trata).

import { ALL_VENUE_TAGS } from "@/lib/venue-tags";

const MODEL = "claude-haiku-4-5-20251001";

export class NoApiKeyError extends Error {}

export type VenueAISuggestion = {
  caracteristicas: string[];
  perfilPublico: string;
};

type ClaudeBlock = { type: string; text?: string };

export async function analyzeVenueWithAI(input: {
  nome: string;
  cidade?: string | null;
  instagram?: string | null;
}): Promise<VenueAISuggestion> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new NoApiKeyError(
      "IA não configurada. Defina ANTHROPIC_API_KEY no ambiente pra usar a análise automática."
    );
  }

  const local = [input.nome, input.cidade].filter(Boolean).join(", ");
  const ig = input.instagram ? `Instagram: ${input.instagram}.` : "";
  const tagList = ALL_VENUE_TAGS.join(", ");

  const prompt = `Você ajuda a banda "The Rock" (rock alternativo dos anos 90 e 2000, de Belo Horizonte) a entender casas/bares onde quer tocar.

Casa: "${local}". ${ig}

Pesquise na web (se útil) o perfil dessa casa — público, estilo musical, tipo de evento, ambiente. Depois responda SOMENTE com um JSON válido, sem texto fora dele, no formato:
{"caracteristicas": string[], "perfilPublico": string}

- "caracteristicas": escolha as que se aplicam, PREFERINDO esta lista quando fizer sentido: ${tagList}. Pode adicionar 1-2 próprias se relevante. Máx 8.
- "perfilPublico": 1-2 frases resumindo o público e se combina com o repertório da The Rock.
Se não achar informação confiável, faça a melhor estimativa e seja honesto na frase.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic falhou (${res.status}): ${txt.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: ClaudeBlock[] };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("A IA não devolveu um JSON reconhecível.");
  const parsed = JSON.parse(match[0]) as Partial<VenueAISuggestion>;

  return {
    caracteristicas: Array.isArray(parsed.caracteristicas)
      ? parsed.caracteristicas.filter((x) => typeof x === "string").slice(0, 8)
      : [],
    perfilPublico:
      typeof parsed.perfilPublico === "string" ? parsed.perfilPublico.slice(0, 600) : "",
  };
}
