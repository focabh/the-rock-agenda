// Geração de setlist por IA (Claude). Recebe o repertório + contexto do show
// (duração, dia, horário, perfil da casa) e devolve a ORDEM pensada como uma
// curva de energia com respiros estratégicos. Sem chave → lança (o caller cai
// no gerador heurístico). Não usa web (tudo vem no prompt) → barato e rápido.

import { NoApiKeyError } from "@/lib/venue-ai";

const MODEL = "claude-haiku-4-5-20251001";

export type AISong = {
  id: string;
  titulo: string;
  artista: string;
  duracaoSeg: number | null;
  energia: number | null;
  conhecida: boolean;
  exigeVocal: boolean;
  momento: string;
  tom: string | null;
  afinacao: string | null;
  finalBoss: boolean;
};

export type SetlistAIInput = {
  songs: AISong[];
  targetMin: number;
  diaSemana: string;
  horario: string;
  casaNome: string;
  casaPerfil: string;
  casaTags: string[];
  setlistAnterior: string[];
  regras: string;
  perfilDesejado: string;
  memoriaAberturas: string[];
  memoriaFechamentos: string[];
  prefs: {
    priConhecidas: boolean;
    priPesadas: boolean;
    priAlternativas: boolean;
    levesNoComeco: boolean;
    evitarVocalDificil: boolean;
  };
};

export type SetlistAIResult = { orderedIds: string[]; racional: string };

export async function generateSetlistAI(
  i: SetlistAIInput
): Promise<SetlistAIResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");

  const repertorio = i.songs.map((s) => ({
    id: s.id,
    titulo: s.titulo,
    artista: s.artista,
    duracaoSeg: s.duracaoSeg ?? 210,
    energia: s.energia ?? 2, // 1 leve, 2 média, 3 pesada
    conhecida: s.conhecida,
    momento: s.momento,
    exigeVocal: s.exigeVocal,
    finalBoss: s.finalBoss,
    tom: s.tom ?? "",
    afinacao: s.afinacao ?? "",
  }));

  const prefs: string[] = [];
  if (i.prefs.priConhecidas) prefs.push("priorizar músicas mais conhecidas");
  if (i.prefs.priPesadas) prefs.push("priorizar músicas mais pesadas");
  if (i.prefs.priAlternativas) prefs.push("priorizar mais alternativas/b-sides");
  if (i.prefs.levesNoComeco) prefs.push("começar mais leve");
  if (i.prefs.evitarVocalDificil)
    prefs.push("evitar músicas difíceis pro vocal");

  const prompt = `Você é diretor de show e curador de setlist veterano, especialista em bandas cover de rock em bares e pubs. Monte a ORDEM perfeita pra manter o público grudado do início ao fim — com picos pra cantar/pular e RESPIROS estratégicos (banheiro, bar, aquele beijo) que nunca esvaziam a pista.

BANDA: The Rock — covers de rock alternativo dos anos 90 e 2000, de BH.

CONTEXTO:
- Duração-alvo: ${i.targetMin} min (conte ~10s de transição por música).
- Dia: ${i.diaSemana}. Início: ${i.horario || "não informado"}.
- Casa: ${i.casaNome} — ${i.casaPerfil || "sem perfil"}. Características: ${i.casaTags.join(", ") || "—"}.
- Última vez nesta casa (NÃO repita abre/fecha nem a ordem): ${i.setlistAnterior.join(", ") || "nenhuma"}.
- Perfil desejado do show: ${i.perfilDesejado || "equilibrado"}.
- Preferências do usuário: ${prefs.join("; ") || "nenhuma específica"}.

MEMÓRIA DA BANDA (aprendida dos setlists já salvos — respeite esses padrões quando fizer sentido):
- Costuma ABRIR com: ${i.memoriaAberturas.join(", ") || "sem histórico ainda"}.
- Costuma FECHAR com: ${i.memoriaFechamentos.join(", ") || "sem histórico ainda"}.
${i.regras ? `\nREGRAS FIXAS DA BANDA (SEMPRE obedeça, têm prioridade): ${i.regras}` : ""}

REPERTÓRIO (use SOMENTE estes id; nunca invente música):
${JSON.stringify(repertorio)}

DRAMATURGIA:
1. Abra com conhecida + energética pra fisgar nos primeiros minutos.
2. Suba até um pico; ponha o 1º RESPIRO (média/conhecida) LOGO APÓS o pico (~primeiro terço). Respiro nunca no começo, nunca dois lentos seguidos, e nunca uma música "morta".
3. Maior pico perto do fim; FECHE com um hino de cantar junto.
   TRAVA (munição pesada): músicas com finalBoss=true são hinos/catarse de FECHAMENTO. Só podem entrar nos ÚLTIMOS 20% do show (fim ou bis). NUNCA nos primeiros 30%. Não desperdice munição pesada cedo.
4. Conhecidas abrem/fecham; faixas menos óbvias ficam nos vales do meio.
5. Vocal: não emende duas que exigem muito do vocal; as difíceis nos picos.
6. Transições suaves (evite saltos bruscos de andamento/tom entre vizinhas).
7. AFINAÇÃO (hardware): agrupe músicas de mesma "afinacao" em blocos contíguos pra MINIMIZAR reafinações no palco — não fique alternando E Standard ↔ Eb ↔ Drop. Use a curva de energia DENTRO/ENTRE esses blocos.
8. ARTISTA: no máximo 2 músicas seguidas do mesmo artista. Intercale bandas.
9. Ajuste ao contexto: sex/sáb à noite ou tarde → +energia/+hits, menos respiros; quinta/happy-hour/cedo/público 30+ → comece ameno e suba; comercial → +conhecidas; pesado → +energia; alternativo → +b-sides; ≤45min → só bala, 1 respiro; ≥120min → blocos com respiros entre eles.
10. PREENCHA o tempo-alvo (tolerância ~1 música).

SAÍDA EXECUTIVA — responda SÓ com JSON compacto, NADA de texto fora dele, SEM justificativa por faixa, SEM introdução/conclusão:
{"perfil":["3 palavras-chave do bar"],"ordem":["<id>","<id>",...],"racional":"≤2 frases sobre a curva"}
"ordem" é um array de ids (strings puras, NÃO objetos). Só ids do repertório, sem repetir.`;

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
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("IA não devolveu JSON.");
  const parsed = JSON.parse(m[0]) as {
    perfil?: unknown;
    ordem?: (string | { id?: string })[];
    racional?: string;
  };

  const valid = new Set(i.songs.map((s) => s.id));
  const seen = new Set<string>();
  const orderedIds = (parsed.ordem ?? [])
    .map((x) => (typeof x === "string" ? x : x?.id))
    .filter((id): id is string => !!id && valid.has(id) && !seen.has(id) && (seen.add(id), true));

  if (orderedIds.length === 0) throw new Error("IA não selecionou músicas válidas.");

  // 3 palavras-chave do bar viram prefixo do racional (curva já vem enxuta).
  const perfil = Array.isArray(parsed.perfil)
    ? parsed.perfil.filter((x) => typeof x === "string").slice(0, 3).join(" · ")
    : "";
  const racionalBase = (parsed.racional ?? "").slice(0, 400);
  const racional = perfil ? `Casa: ${perfil}. ${racionalBase}`.trim() : racionalBase;
  return { orderedIds, racional };
}

// ---- Crítica de setlist (validação humana): a IA avalia a ORDEM atual ----

export type CritiqueSong = {
  titulo: string;
  artista: string;
  energia: number | null;
  conhecida: boolean;
  exigeVocal: boolean;
  momento: string;
  finalBoss: boolean;
};

export type SetlistCritique = {
  veredito: "forte" | "ok" | "fraco";
  alertas: string[];
};

export async function critiqueSetlist(input: {
  songs: CritiqueSong[]; // NA ORDEM atual
  targetMin: number;
  diaSemana: string;
  casaTags: string[];
}): Promise<SetlistCritique> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");

  const lista = input.songs.map((s, i) => ({
    pos: i + 1,
    titulo: s.titulo,
    artista: s.artista,
    energia: s.energia ?? 2,
    conhecida: s.conhecida,
    exigeVocal: s.exigeVocal,
    momento: s.momento,
    finalBoss: s.finalBoss,
  }));

  const prompt = `Você é diretor musical de shows ao vivo. Avalie a ORDEM deste setlist (NÃO reordene; só critique) pra um show de ~${input.targetMin} min, ${input.diaSemana}, casa: ${input.casaTags.join(", ") || "—"}.

SETLIST (na ordem):
${JSON.stringify(lista)}

Aponte PROBLEMAS de dinâmica, se houver: música finalBoss/hino cedo demais (não nos últimos ~20%); abertura fraca/sem identidade; queda brusca de energia; duas músicas de exigeVocal seguidas; mesmo artista em sequência; respiro/lenta logo no início; final fraco; energia monótona (sem picos/vales).

Responda SOMENTE com JSON:
{"veredito":"forte|ok|fraco","alertas":["alerta curto e acionável", ...]}
Se estiver bem montado, "alertas":[] e veredito "forte" ou "ok". Máx 6 alertas.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
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
  const parsed = JSON.parse(m[0]) as { veredito?: string; alertas?: unknown };
  const veredito =
    parsed.veredito === "forte" || parsed.veredito === "fraco"
      ? parsed.veredito
      : "ok";
  const alertas = Array.isArray(parsed.alertas)
    ? parsed.alertas.filter((x) => typeof x === "string").slice(0, 6)
    : [];
  return { veredito, alertas };
}
