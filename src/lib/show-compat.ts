// Parecer técnico (Haiku, saída executiva/zero-chatter): a infra da banda
// comporta as exigências da casa? Custo mínimo (poucas frases de saída).
import { NoApiKeyError } from "@/lib/venue-ai";

const MODEL = "claude-haiku-4-5-20251001";

export async function checkCompat(
  bandInfra: string,
  venueInfra: string
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");

  const prompt = `Atue como técnico de som. Avalie em no máximo 2 frases se os equipamentos de infraestrutura da banda comportam as exigências do evento enviado. Foque em restrições críticas (energia, canais, espaço). Responda SÓ o parecer direto, sem introdução nem conclusão.

INFRAESTRUTURA DA BANDA:
${bandInfra || "(não informada)"}

INFRAESTRUTURA/EXIGÊNCIAS DA CASA:
${venueInfra || "(não informada)"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 160,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok)
    throw new Error(`Anthropic falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join(" ")
    .trim()
    .slice(0, 500);
}
