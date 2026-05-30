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

  const prompt = `Você é analista de cena musical e "A&R" da banda The Rock (cover de rock alternativo dos anos 90/2000, de BH). Avalie esta CASA com PRECISÃO baseada em EVIDÊNCIAS reais — nunca em achismo.

Casa: "${local}". ${ig}

PESQUISE na web, priorizando evidência real nesta ordem:
- Instagram: bio (telefone/horários/"música ao vivo"), posts/reels recentes (flyers de line-up, fotos de palco e de público), stories destacados, hashtags.
- Google: categoria do lugar, avaliações, faixa de preço, fotos.
- Site/Linktree oficial.

AVALIE (preencha só o que a evidência sustentar): tipo de casa; se faz MÚSICA AO VIVO com banda e em quais dias; estilo predominante e se é COVER; se já contrata banda cover de rock (sinal forte de fit); público (faixa etária, vibe, porte); alinhamento com a The Rock (rock alt 90/2000).

HONESTIDADE (regras duras): só afirme o que a evidência sustenta; diferencie "encontrado" de "estimado"; desconhecido → null/“baixa”; NUNCA invente. Cite 1-2 evidências curtas e literais.

Responda SOMENTE com JSON válido, sem texto fora dele:
{"caracteristicas": string[], "perfilPublico": string, "alinhamento": "alto|médio|baixo", "confianca": "alta|média|baixa", "evidencias": string[]}

- "caracteristicas": máx 8, PREFERINDO esta lista quando fizer sentido: ${tagList}. Pode adicionar próprias se relevante.
- "perfilPublico": 2-3 frases sobre o público e se combina com o repertório da The Rock.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
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
  const parsed = JSON.parse(match[0]) as {
    caracteristicas?: unknown;
    perfilPublico?: unknown;
    alinhamento?: unknown;
    confianca?: unknown;
  };

  const base =
    typeof parsed.perfilPublico === "string" ? parsed.perfilPublico.trim() : "";
  const alinhamento =
    typeof parsed.alinhamento === "string" ? parsed.alinhamento : "";
  const confianca =
    typeof parsed.confianca === "string" ? parsed.confianca : "";
  const extra = alinhamento
    ? ` (Alinhamento: ${alinhamento}${confianca ? `, confiança ${confianca}` : ""}.)`
    : "";

  return {
    caracteristicas: Array.isArray(parsed.caracteristicas)
      ? parsed.caracteristicas.filter((x) => typeof x === "string").slice(0, 8)
      : [],
    perfilPublico: (base + extra).slice(0, 700),
  };
}
