// Gera a bio comercial da banda (Haiku, sob demanda) a partir de dados REAIS do
// banco — sem alucinação, custo de frações de centavo, e o texto vira cache.
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { songs, shows } from "@/db/schema";
import { NoApiKeyError } from "@/lib/venue-ai";

const MODEL = "claude-haiku-4-5-20251001";
const ENERGIA_LABEL: Record<number, string> = { 1: "leve", 2: "média", 3: "pesada" };

export type BioData = {
  topArtistas: string[];
  energia: string;
  ultimasCasas: string[];
};

/** Compila os dados pra bio: 3 artistas mais tocados (prontas), energia
 *  predominante e as últimas 3 casas onde tocou. */
export async function compileBioData(): Promise<BioData> {
  const prontas = await db.select().from(songs).where(eq(songs.status, "pronta"));

  const porArtista = new Map<string, number>();
  const energias: number[] = [];
  for (const s of prontas) {
    if (s.artista) porArtista.set(s.artista, (porArtista.get(s.artista) ?? 0) + 1);
    energias.push(s.energia ?? 2);
  }
  const topArtistas = [...porArtista.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([a]) => a);

  const media = energias.length ? energias.reduce((t, e) => t + e, 0) / energias.length : 2;
  const energia = ENERGIA_LABEL[Math.round(media)] ?? "média";

  const passados = await db.query.shows.findMany({
    where: inArray(shows.status, ["concluido"]),
    with: { casa: { columns: { nome: true } } },
    orderBy: [desc(shows.data)],
    limit: 8,
  });
  const ultimasCasas = [...new Set(passados.map((s) => s.casa.nome))].slice(0, 3);

  return { topArtistas, energia, ultimasCasas };
}

export async function generateBioAI(bandName: string, d: BioData): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");

  const prompt = `Gere uma bio comercial curta de 3 parágrafos para a banda ${bandName} focado em contratantes. Dados: Bandas mais tocadas: ${d.topArtistas.join(", ") || "rock variado"}. Energia: ${d.energia}. Onde tocou: ${d.ultimasCasas.join(", ") || "casas de BH"}. Parágrafo 1: Estilo e DNA. Parágrafo 2: Dinâmica de palco profissional. Parágrafo 3: Autoridade nos pubs citados. Retorne APENAS o texto limpo, sem nenhuma introdução ou formatação extra.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok)
    throw new Error(`Anthropic falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim()
    .slice(0, 2000);
}
