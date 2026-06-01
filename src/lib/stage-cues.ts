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
};

export const CUE_LABEL: Record<StageCueType, string> = {
  publico: "Falar com o público",
  casa: "Agradecer à casa",
  banda: "Apresentar a banda",
  redes: "Redes sociais",
  saideira: "Avisar que tá acabando",
  ultima: "Última música",
  presenca: "Agradecer a presença",
};

export const CUE_EMOJI: Record<StageCueType, string> = {
  publico: "🙌",
  casa: "🏠",
  banda: "🎸",
  redes: "📲",
  saideira: "🍻",
  ultima: "🔥",
  presenca: "🙏",
};

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
