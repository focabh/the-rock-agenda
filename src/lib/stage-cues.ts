// Roteiro de palco: sugere QUANDO falar o quê durante o show (agradecer a casa,
// apresentar a banda, chamar pras redes, saideira, última música, etc.).
//
// Heurística GRÁTIS e offline: esses momentos dependem da ESTRUTURA do show
// (posição + curva de energia), não do conteúdo da letra — então dá pra
// posicioná-los bem sem ler nada nem gastar IA. A IA (opcional) só refina a
// redação/escolha da música.

export type StageCueType =
  | "publico"
  | "casa"
  | "data"
  | "banda"
  | "redes"
  | "saideira"
  | "ultima"
  | "presenca";

export type StageCue = {
  /** Aparece ANTES da música nesta posição (0 = antes da 1ª; N = depois da última). */
  slot: number;
  tipo: StageCueType;
  fala: string;
};

export type CueSong = { energia: number | null; momento: string };

export type StageCueContext = {
  casaNome?: string | null;
  bandName?: string | null;
  redes?: string | null; // ex.: "@therock" ou "Instagram"
  dataMs?: number | null; // data do show → detecta feriado/data especial
};

export const CUE_LABEL: Record<StageCueType, string> = {
  publico: "Falar com o público",
  casa: "Agradecer à casa",
  data: "Data especial",
  banda: "Apresentar a banda",
  redes: "Redes sociais",
  saideira: "Avisar que tá acabando",
  ultima: "Última música",
  presenca: "Agradecer a presença",
};

export const CUE_EMOJI: Record<StageCueType, string> = {
  publico: "🙌",
  casa: "🏠",
  data: "🎉",
  banda: "🎸",
  redes: "📲",
  saideira: "🍻",
  ultima: "🔥",
  presenca: "🙏",
};

/** Páscoa (algoritmo de Meeus/Gregoriano). Retorna {month(1-12), day}. */
function easter(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const mmdd = (m: number, d: number) =>
  `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Se a data (ms) cai num feriado/data importante, devolve o nome; senão null.
 *  Nacionais fixos + móveis (Páscoa) + alguns de BH + datas de casa cheia. */
export function specialDateLabel(dataMs: number): string | null {
  const d = new Date(dataMs);
  // Dia/mês/ano no fuso de SP (a data é guardada em ms; evita erro de borda).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [yStr, mStr, dStr] = parts.split("-");
  const year = Number(yStr);
  const key = `${mStr}-${dStr}`;

  const fixos: Record<string, string> = {
    "01-01": "Ano-Novo",
    "04-21": "Tiradentes",
    "05-01": "Dia do Trabalho",
    "09-07": "Independência",
    "10-12": "Nossa Senhora Aparecida",
    "11-02": "Finados",
    "11-15": "Proclamação da República",
    "11-20": "Consciência Negra",
    "12-24": "véspera de Natal",
    "12-25": "Natal",
    "12-31": "Réveillon",
    "06-12": "Dia dos Namorados",
    // Belo Horizonte:
    "08-15": "Assunção de Nossa Senhora (feriado de BH)",
    "12-08": "Imaculada Conceição (padroeira de BH)",
  };
  if (fixos[key]) return fixos[key];

  // Móveis: baseadas na Páscoa.
  const e = easter(year);
  const easterUTC = new Date(Date.UTC(year, e.month - 1, e.day));
  const shifted = (days: number) => {
    const x = new Date(easterUTC);
    x.setUTCDate(x.getUTCDate() + days);
    return mmdd(x.getUTCMonth() + 1, x.getUTCDate());
  };
  const moveis: Record<string, string> = {
    [shifted(-48)]: "Carnaval",
    [shifted(-47)]: "Carnaval",
    [shifted(-2)]: "Sexta-feira Santa",
    [shifted(0)]: "Páscoa",
    [shifted(60)]: "Corpus Christi",
  };
  return moveis[key] ?? null;
}

/** Posiciona os momentos de fala pela estrutura do setlist. Determinístico. */
export function computeStageCues(
  songs: CueSong[],
  ctx: StageCueContext = {}
): StageCue[] {
  const n = songs.length;
  if (n === 0) return [];

  const banda = ctx.bandName?.trim() || "a banda";
  const casa = ctx.casaNome?.trim();
  const redes = ctx.redes?.trim();
  const energia = (i: number) => songs[i]?.energia ?? 2;

  const cues: StageCue[] = [];
  const add = (slot: number, tipo: StageCueType, fala: string) =>
    cues.push({ slot: Math.max(0, Math.min(n, slot)), tipo, fala });

  // Acha o respiro mais calmo perto de uma posição-alvo (pra apresentar a banda
  // num momento de menor energia, sem cortar um pico).
  const calmestNear = (target: number, radius = 2) => {
    let best = target;
    let bestE = Infinity;
    for (let i = Math.max(1, target - radius); i <= Math.min(n - 1, target + radius); i++) {
      if (energia(i) < bestE) {
        bestE = energia(i);
        best = i;
      }
    }
    return best;
  };

  if (n <= 2) {
    // Show curtíssimo: só o essencial.
    add(0, "publico", "Cumprimenta a galera e já manda a primeira.");
    add(n, "presenca", casa ? `Agradece à casa (${casa}) e a presença de todos.` : "Agradece a casa e a presença de todos.");
    if (n === 2) add(n - 1, "ultima", "Anuncia que essa é a última — pra cima!");
    return cues.sort(ordenarPorSlot);
  }

  // Início: fisga o público e agradece a casa logo cedo.
  add(1, "publico", "Fala com a galera — pergunta como tá todo mundo, esquenta o público.");
  // Data especial / feriado: agradece quem tirou um tempo nesse dia pra vir.
  const dataLabel = ctx.dataMs ? specialDateLabel(ctx.dataMs) : null;
  if (dataLabel) {
    add(1, "data", `Hoje é ${dataLabel} — agradeça quem deixou a data de lado e tirou um tempo pra estar aqui${casa ? ` no ${casa}` : ""}.`);
  }
  add(2, "casa", casa ? `Agradece à casa: "valeu, ${casa}!" — cita o nome do lugar.` : "Agradece à casa pelo espaço (cita o nome do lugar).");

  // Meio: apresenta a banda num respiro.
  const meio = calmestNear(Math.round(n * 0.5));
  add(meio, "banda", `Apresenta ${banda} — nome e instrumento de cada um.`);

  // Redes: 1–2 chamadas, sem exagerar.
  if (n >= 8) {
    add(Math.round(n * 0.4), "redes", redes ? `Chama pra seguir nas redes (${redes}).` : "Chama a galera pra seguir a banda nas redes.");
    add(Math.round(n * 0.78), "redes", "Reforça as redes rapidinho — agenda dos próximos shows.");
  } else if (n >= 5) {
    add(Math.round(n * 0.6), "redes", redes ? `Chama pra seguir nas redes (${redes}).` : "Chama a galera pra seguir a banda nas redes.");
  }

  // Fim: saideira, última e agradecimento.
  add(n - 2, "saideira", "Avisa que tá chegando ao fim — reta final, aproveita!");
  add(n - 1, "ultima", "Agora é a última MESMO — anuncia com energia, chama todo mundo pra cantar.");
  add(n, "presenca", "Agradece a presença de todos, com sentimento. Boa noite!");

  return cues.sort(ordenarPorSlot);
}

function ordenarPorSlot(a: StageCue, b: StageCue) {
  return a.slot - b.slot;
}
