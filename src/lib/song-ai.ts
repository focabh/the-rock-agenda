// Inferência de metadados de música via Claude (sem web — o modelo conhece as
// músicas). Preenche energia/conhecida/momento das faixas que ainda não têm.

import { NoApiKeyError } from "@/lib/venue-ai";

const MODEL = "claude-haiku-4-5-20251001";
const MOMENTOS = ["qualquer", "abertura", "meio", "fechamento"];

export type SongMetaSuggestion = {
  id: string;
  energia: number | null;
  conhecida: boolean | null;
  momento: string | null;
  finalBoss: boolean | null;
};

export async function enrichSongsWithAI(
  songs: { id: string; titulo: string; artista: string }[]
): Promise<SongMetaSuggestion[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");
  if (songs.length === 0) return [];

  const prompt = `Você conhece muito bem rock, pop e música ao vivo. Para cada música abaixo (repertório de uma banda cover), infira com base no SEU conhecimento da faixa:
- "energia": 1 = leve/acústica/balada, 2 = média, 3 = pesada/agitada/pra pular.
- "conhecida": true se é um HIT muito conhecido do público geral (canta junto); false se é mais de nicho.
- "momento": onde funciona melhor num show ao vivo: "abertura", "meio", "fechamento" ou "qualquer".
- "finalBoss": true se é um HINO/catarse que normalmente FECHA show (munição pesada de fim); senão false.

Responda SOMENTE com um array JSON, sem texto fora dele:
[{"id":"<id>","energia":1,"conhecida":true,"momento":"qualquer","finalBoss":false}]

Músicas:
${JSON.stringify(songs.map((s) => ({ id: s.id, titulo: s.titulo, artista: s.artista })))}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
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
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("IA não devolveu JSON.");
  const arr = JSON.parse(m[0]) as Array<Record<string, unknown>>;

  const valid = new Set(songs.map((s) => s.id));
  return arr
    .filter((x) => typeof x.id === "string" && valid.has(x.id as string))
    .map((x) => ({
      id: x.id as string,
      energia:
        typeof x.energia === "number" && x.energia >= 1 && x.energia <= 3
          ? Math.round(x.energia)
          : null,
      conhecida: typeof x.conhecida === "boolean" ? x.conhecida : null,
      momento:
        typeof x.momento === "string" && MOMENTOS.includes(x.momento)
          ? x.momento
          : null,
      finalBoss: typeof x.finalBoss === "boolean" ? x.finalBoss : null,
    }));
}
