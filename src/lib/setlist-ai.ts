// Geração de setlist por IA (Claude). Recebe o repertório + contexto do show
// (duração, dia, horário, perfil da casa) e devolve a ORDEM pensada como uma
// curva de energia com respiros estratégicos. Sem chave → lança (o caller cai
// no gerador heurístico). Não usa web (tudo vem no prompt) → barato e rápido.

import { NoApiKeyError } from "@/lib/venue-ai";
import type { StageCue, StageCueType } from "@/lib/stage-cues";

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
  dropada: boolean;
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
  /** Gosto do público desse evento (show.publicoPerfil) — manda em festa privada. */
  publicoGosto: string;
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
    dropada: s.dropada,
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
- O QUE O PÚBLICO CURTE (priorize músicas que casem com isso): ${i.publicoGosto || "não informado"}.
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
7. AFINAÇÃO (hardware): agrupe as músicas DROPADAS ("dropada":true) num bloco contíguo pra MINIMIZAR reafinações no palco — não fique entrando e saindo de drop. Use a curva de energia DENTRO/ENTRE os blocos.
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

// ---- Sugestões de AJUSTE por IA: remover/adicionar/trocar pensando no PÚBLICO ----

export type AISuggestSong = {
  id: string;
  titulo: string;
  artista: string;
  duracaoSeg: number | null;
  energia: number | null;
  status: string;
  finalBoss: boolean;
};

export type AISetlistSuggestion =
  | { kind: "remove"; songId: string; reason: string }
  | { kind: "add"; songId: string; reason: string }
  | { kind: "swap"; removeSongId: string; addSongId: string; reason: string };

export async function suggestSetlistChangesAI(input: {
  set: AISuggestSong[];
  pool: AISuggestSong[];
  targetMin: number;
  publicoPerfil: string;
  casaTags: string[];
  privado: boolean;
}): Promise<AISetlistSuggestion[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");

  const fmt = (s: AISuggestSong) => ({
    id: s.id,
    titulo: s.titulo,
    artista: s.artista,
    duracaoSeg: s.duracaoSeg ?? 210,
    energia: s.energia ?? 2,
    status: s.status,
    finalBoss: s.finalBoss,
  });

  const prompt = `Você é diretor musical de banda cover de rock (The Rock — covers de rock alternativo 90/2000, BH). Sugira AJUSTES no setlist pra (1) bater o tempo-alvo e (2) AGRADAR ESTE PÚBLICO. NÃO reordene — só diga o que remover, adicionar e trocar.

CONTEXTO DO EVENTO:
- ${input.privado ? "Evento PARTICULAR (festa privada) — o gosto do público manda mais que 'padrão de bar'." : "Show em casa/bar."}
- Duração-alvo: ${input.targetMin} min (conte ~10s de transição por música).
- O QUE O PÚBLICO CURTE: ${input.publicoPerfil || "não informado"}.
- Perfil/tags da casa: ${input.casaTags.join(", ") || "—"}.

SETLIST ATUAL (use SOMENTE estes id pra remover):
${JSON.stringify(input.set.map(fmt))}

REPERTÓRIO DISPONÍVEL fora do setlist (use SOMENTE estes id pra adicionar):
${JSON.stringify(input.pool.map(fmt))}

REGRAS: nunca invente id; prefira músicas status "pronta"; não remova finalBoss; foque no que casa com o gosto do público; se faltar/sobrar tempo, ajuste a quantidade.

Responda SOMENTE com JSON:
{"suggestions":[
  {"kind":"remove","songId":"<id do setlist>","reason":"curto e acionável"},
  {"kind":"add","songId":"<id do pool>","reason":"..."},
  {"kind":"swap","removeSongId":"<id do setlist>","addSongId":"<id do pool>","reason":"..."}
]}
Máx 8. Se já está ótimo pro tempo e pro público, devolva {"suggestions":[]}.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
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
  const parsed = JSON.parse(m[0]) as { suggestions?: unknown };
  const setIds = new Set(input.set.map((s) => s.id));
  const poolIds = new Set(input.pool.map((s) => s.id));
  const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const out: AISetlistSuggestion[] = [];
  for (const r of raw as Record<string, string>[]) {
    if (!r || typeof r.reason !== "string") continue;
    if (r.kind === "remove" && setIds.has(r.songId))
      out.push({ kind: "remove", songId: r.songId, reason: r.reason });
    else if (r.kind === "add" && poolIds.has(r.songId))
      out.push({ kind: "add", songId: r.songId, reason: r.reason });
    else if (
      r.kind === "swap" &&
      setIds.has(r.removeSongId) &&
      poolIds.has(r.addSongId)
    )
      out.push({
        kind: "swap",
        removeSongId: r.removeSongId,
        addSongId: r.addSongId,
        reason: r.reason,
      });
    if (out.length >= 8) break;
  }
  return out;
}

// ---- Crítica de setlist de ENSAIO: foco em como as PRIORITÁRIAS se encaixam ----

export type CritiqueEnsaioSong = CritiqueSong & {
  prioridade: boolean; // marcada com estrela (foco do ensaio)
  dropada: boolean;
};

export async function critiqueEnsaioSetlist(input: {
  songs: CritiqueEnsaioSong[]; // NA ORDEM atual
  targetMin: number;
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
    dropada: s.dropada,
    prioritaria: s.prioridade,
  }));
  const priTitulos = input.songs.filter((s) => s.prioridade).map((s) => s.titulo);

  const prompt = `Você é diretor musical e prepara um ENSAIO de banda cover de rock. Diferente de um show, aqui o objetivo é TREINAR — e as músicas marcadas como PRIORITÁRIAS (prioritaria:true) são o foco do ensaio.

PRIORITÁRIAS (foco): ${priTitulos.join(", ") || "nenhuma marcada"}.

SETLIST DO ENSAIO (na ordem atual; prioritárias já vêm fixadas no topo):
${JSON.stringify(lista)}

Avalie (NÃO reordene; só critique) COMO AS PRIORITÁRIAS SE ENCAIXAM com o restante do repertório do ensaio. Foque em:
- COLOCAÇÃO: faz sentido tocar as prioritárias logo no começo (cabeça fresca pra treinar o difícil)? Alguma deveria vir antes/depois de outra?
- AGRUPAMENTO: prioritárias que compartilham afinação DROP (dropada:true), tom ou andamento parecido deveriam ser ensaiadas em sequência (menos reafinação/troca de contexto)? Alguma quebra isso?
- CATEGORIA/ENERGIA: misturar uma pesada com uma leve ajuda ou atrapalha o foco do treino? Sugira pares/blocos.
- TRANSIÇÃO pro resto: depois das prioritárias, o set engata bem no restante (sem salto brusco)?
- Se NÃO houver prioritárias marcadas, diga isso como 1º alerta e avalie o set como treino geral.

Cada alerta deve ser CURTO e ACIONÁVEL (ex.: "Toque 'X' logo após 'Y' — as duas são drop").

Responda SOMENTE com JSON:
{"veredito":"forte|ok|fraco","alertas":["...", ...]}
Se estiver bem encaixado, "alertas":[] e veredito "forte" ou "ok". Máx 6 alertas.`;

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

// ---- Roteiro de palco por IA (opcional): refina os momentos de fala ----

const CUE_TYPES: StageCueType[] = [
  "publico",
  "casa",
  "data",
  "banda",
  "redes",
  "saideira",
  "ultima",
  "presenca",
];

export async function refineStageCuesAI(input: {
  songs: { titulo: string; artista: string; energia: number | null; momento: string; temLetra: boolean }[];
  casaNome?: string | null;
  bandName?: string | null;
  redes?: string | null;
  dataEspecial?: string | null;
}): Promise<StageCue[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada.");

  const n = input.songs.length;
  const lista = input.songs.map((s, i) => ({
    pos: i + 1,
    titulo: s.titulo,
    artista: s.artista,
    energia: s.energia ?? 2,
    momento: s.momento,
  }));

  const prompt = `Você é diretor de show. Olhando este setlist NA ORDEM, sugira os MOMENTOS DE FALA do vocalista entre as músicas, pra um show de bar/pub.

BANDA: ${input.bandName || "The Rock"}.${input.casaNome ? ` CASA: ${input.casaNome}.` : ""}${input.dataEspecial ? ` DATA ESPECIAL: hoje é ${input.dataEspecial} (agradeça quem tirou um tempo nessa data pra vir).` : ""}${input.redes ? ` REDES: ${input.redes}.` : ""}

SETLIST (${n} músicas, na ordem):
${JSON.stringify(lista)}

Tipos de fala possíveis (use estes códigos): publico (cumprimentar/animar), casa (agradecer ao lugar, citando o nome), data (mencionar a data especial/feriado e agradecer quem veio mesmo assim — só se houver DATA ESPECIAL acima), banda (apresentar integrantes), redes (chamar pra seguir — no MÁX 2 no show, sem exagero), saideira (avisar que tá acabando), ultima (anunciar a última música), presenca (agradecer a presença no fim).

REGRAS:
- "slot" = posição onde a fala entra: 0 = antes da 1ª música; ${n} = depois da última. Use a estrutura/energia: agradecer casa/público cedo, apresentar banda num respiro do meio, saideira perto do fim, "ultima" logo antes da última, "presenca" no fim (slot ${n}).
- Cada fala curta (1 frase), em PT-BR, tom de palco, acionável (o que falar).
- Não exagere nas redes (máx 2). Não repita tipos sem necessidade.

Responda SOMENTE com JSON:
{"cues":[{"slot":0,"tipo":"publico","fala":"..."}, ...]}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
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
  const parsed = JSON.parse(m[0]) as { cues?: { slot?: number; tipo?: string; fala?: string }[] };
  const cues = (parsed.cues ?? [])
    .filter((c) => typeof c.fala === "string" && CUE_TYPES.includes(c.tipo as StageCueType))
    .map((c) => ({
      slot: Math.max(0, Math.min(n, Math.round(Number(c.slot) || 0))),
      tipo: c.tipo as StageCueType,
      fala: (c.fala as string).slice(0, 200),
    }))
    .sort((a, b) => a.slot - b.slot);
  if (cues.length === 0) throw new Error("IA não devolveu momentos válidos.");
  return cues;
}
