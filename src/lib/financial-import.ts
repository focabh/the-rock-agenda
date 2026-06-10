// Mapeamento de relatório financeiro (planilha colada / CSV) via Claude Haiku.
// A IA só ESTRUTURA as colunas; conversão de valor/data é feita em código (mais
// confiável). Sempre Haiku, sem web. É disparado pelo usuário (custo ok).

import { NoApiKeyError } from "@/lib/venue-ai";
import { parseBRLToCentavos } from "@/lib/formatters";

const MODEL = "claude-haiku-4-5-20251001";

export type MappedGasto = {
  descricao: string;
  recipient: string;
  valorCentavos: number;
  paidEmISO: string;
  tipo: "show" | "extra";
};

export type AiRow = {
  descricao?: string;
  recipient?: string;
  valor?: string | number;
  data?: string;
  tipo?: string;
};

/** Normaliza as linhas cruas da IA em gastos válidos (puro — testável sem API):
 *  converte valor→centavos, data→ISO, descarta linhas sem valor positivo. */
export function normalizeAiRows(rows: AiRow[], nowMs: number): MappedGasto[] {
  const fallback = new Date(nowMs);
  return rows
    .map((r): MappedGasto | null => {
      const valorCentavos =
        typeof r.valor === "number"
          ? Math.round(r.valor * 100)
          : parseBRLToCentavos(String(r.valor ?? ""));
      if (!valorCentavos || valorCentavos <= 0) return null;
      const descricao = (r.descricao || "Gasto importado").toString().slice(0, 200);
      return {
        descricao,
        recipient: (r.recipient || descricao).toString().slice(0, 200),
        valorCentavos,
        paidEmISO: parseDateLoose(r.data, fallback).toISOString(),
        tipo: r.tipo === "show" ? "show" : "extra",
      };
    })
    .filter((x): x is MappedGasto => x !== null);
}

/** Tenta interpretar data em vários formatos (DD/MM/YYYY, YYYY-MM-DD, etc.). */
function parseDateLoose(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(Date.UTC(y, +m[2] - 1, +m[1], 12));
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function mapFinancialRowsWithAI(
  raw: string,
  nowMs: number
): Promise<MappedGasto[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");
  const text = raw.trim();
  if (!text) return [];

  const prompt = `Você recebe um relatório financeiro BRUTO de uma banda (colado de planilha/CSV, colunas em qualquer ordem, com ou sem cabeçalho). Extraia CADA LANÇAMENTO DE GASTO/DESPESA (dinheiro que SAIU). Ignore linhas de receita/cachê recebido, totais e cabeçalhos.

Para cada gasto, devolva:
- "descricao": o que foi (ex.: "cordas de guitarra", "gasolina", "aluguel de PA").
- "recipient": pra quem foi (loja/fornecedor/pessoa). Se não houver, repita a descrição.
- "valor": o valor em reais como string (ex.: "150,00" ou "1.200,50").
- "data": a data do gasto, no formato que aparecer (ex.: "12/03/2026"). Se não houver, "".
- "tipo": "show" se claramente ligado a um show específico; senão "extra".

Responda SOMENTE com um array JSON, sem texto fora dele:
[{"descricao":"...","recipient":"...","valor":"150,00","data":"12/03/2026","tipo":"extra"}]

Relatório:
${text.slice(0, 12000)}`;

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
  if (!res.ok) {
    throw new Error(`Anthropic falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const out = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
  const m = out.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("IA não devolveu JSON.");

  const rows = JSON.parse(m[0]) as AiRow[];
  return normalizeAiRows(rows, nowMs);
}
