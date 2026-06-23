// Mapeia o repertório inteiro pros presets do pedal de voz numa ÚNICA chamada
// (Haiku) — econômico. Maioria cai no "universal"; só foge quando a música pede.

import { NoApiKeyError } from "@/lib/venue-ai";
import type { VozPreset } from "@/lib/voz-pedais";

const MODEL = "claude-haiku-4-5-20251001";

export type VozPresetSong = {
  id: string;
  titulo: string;
  artista: string;
  energia: number | null;
};

/** Retorna { songId: presetId }. Valida ids; o caller completa o resto com universal. */
export async function assignVozPresetsAI(input: {
  songs: VozPresetSong[];
  presets: VozPreset[];
  modeloNome: string;
}): Promise<Record<string, string>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");

  const presetList = input.presets.map((p) => ({
    id: p.id,
    nome: p.nome,
    desc: p.desc,
    universal: !!p.universal,
  }));
  const songs = input.songs.map((s) => ({
    id: s.id,
    titulo: s.titulo,
    artista: s.artista,
    energia: s.energia ?? 2,
  }));

  const prompt = `Você é engenheiro de som de banda cover de rock. Para CADA música, escolha o MELHOR preset do pedal de voz ${input.modeloNome} pro vocalista — pensando em mexer o MÍNIMO. Use o preset "universal" pra MAIORIA; só fuja dele quando a música claramente pede (balada/lenta → reverb maior; peso/grunge → preset pesado; refrão grande/épico → harmonia ou dobra; fala/seco → seco).

PRESETS (use SOMENTE estes id):
${JSON.stringify(presetList)}

MÚSICAS (energia: 1 leve, 2 média, 3 pesada):
${JSON.stringify(songs)}

Responda SOMENTE com JSON cobrindo TODAS as músicas:
{"map":{"<songId>":"<presetId>"}}
Nunca invente id. Na dúvida, "universal".`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
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
  const parsed = JSON.parse(m[0]) as { map?: Record<string, string> };
  const songIds = new Set(input.songs.map((s) => s.id));
  const presetIds = new Set(input.presets.map((p) => p.id));
  const out: Record<string, string> = {};
  for (const [songId, presetId] of Object.entries(parsed.map ?? {})) {
    if (songIds.has(songId) && presetIds.has(presetId)) out[songId] = presetId;
  }
  return out;
}
