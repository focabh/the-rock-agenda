// Gerador de setlist: combina duração do show + perfil/tags da casa + metadados
// das músicas. Função PURA e determinística (recebe seed) — fácil de testar.
// É só uma SUGESTÃO inicial; o usuário ajusta tudo manualmente depois.

import { arrangeSetlist, type ArrangeSong } from "./setlist-arrange";

const toArrange = (s: GenSong): ArrangeSong => ({
  id: s.id,
  dropada: !!s.dropada,
  artista: s.artista ?? "",
  energia: s.energia,
  momento: s.momento,
  conhecida: s.conhecida,
  finalBoss: !!s.finalBoss,
});

export type GenSong = {
  id: string;
  status: string;
  duracaoSeg: number | null;
  energia: number | null; // 1 leve .. 3 pesada
  conhecida: boolean;
  exigeVocal: boolean;
  momento: string; // qualquer|abertura|meio|fechamento
  finalBoss?: boolean; // hino/munição pesada → vai pro fim, nunca no início
  artista?: string; // p/ intercalar artistas (máx 2 seguidas)
  dropada?: boolean; // p/ agrupar dropadas e minimizar reafinações
};

export type GenOptions = {
  targetSeg: number;
  venueTags: string[];
  priConhecidas: boolean;
  priPesadas: boolean;
  priAlternativas: boolean;
  levesNoComeco: boolean;
  evitarVocalDificil: boolean;
  ordem: "equilibrada" | "aleatoria";
  evitarRepetir: boolean;
  avoidIds: string[];
  seed: number;
  /** Teto de energia (feedback CRM: casa pediu som mais baixo). */
  tetoEnergia?: number;
};

export type GenResult = { orderedIds: string[]; totalSeg: number };

const DEFAULT_DUR = 210; // 3min30 quando a música não tem duração

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSetlist(songs: GenSong[], o: GenOptions): GenResult {
  const rand = mulberry32(o.seed || 1);
  const dur = (s: GenSong) =>
    s.duracaoSeg && s.duracaoSeg > 0 ? s.duracaoSeg : DEFAULT_DUR;
  const energy = (s: GenSong) => s.energia ?? 2;

  const tags = new Set(o.venueTags.map((t) => t.toLowerCase()));
  const venuePesado = tags.has("setlist pesado") || tags.has("público pesado");
  const venuePopular =
    tags.has("setlist popular") || tags.has("público comercial");
  const venueAlt =
    tags.has("setlist alternativo") || tags.has("rock alternativo 90/2000");
  const venueLeve = tags.has("setlist leve");

  const wantConhecidas = o.priConhecidas || venuePopular;
  const wantPesadas = o.priPesadas || venuePesado;
  const wantAlt = o.priAlternativas || venueAlt;
  const wantLeve = venueLeve;

  let eligible = songs.filter(
    (s) => s.status !== "aposentada" && s.status !== "ideia_futura"
  );

  // Feedback do CRM: casa pediu som mais baixo → teto de energia. Só aplica se
  // ainda sobrar repertório suficiente; senão ignora pra não esvaziar.
  if (o.tetoEnergia != null) {
    const capped = eligible.filter((s) => energy(s) <= o.tetoEnergia!);
    if (capped.length >= 4) eligible = capped;
  }

  const scored = eligible
    .map((s) => {
      let score = 1 + rand() * (o.ordem === "aleatoria" ? 6 : 1.2);
      if (wantConhecidas && s.conhecida) score += 2.5;
      if (wantPesadas) score += energy(s);
      if (wantLeve) score += 4 - energy(s);
      if (wantAlt && !s.conhecida) score += 1.5;
      if (o.evitarVocalDificil && s.exigeVocal) score -= 3;
      if (o.evitarRepetir && o.avoidIds.includes(s.id)) score -= 4;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);

  // Seleciona até preencher o tempo-alvo, contando ~10s de transição por
  // música (tempo de palco real). Tolera ultrapassar com a última.
  const picked: GenSong[] = [];
  let total = 0;
  for (const { s } of scored) {
    if (total >= o.targetSeg) break;
    picked.push(s);
    total += dur(s) + 10;
  }

  // Arranjo: agrupa afinações (minimiza reafinações), curva de energia,
  // intercala artistas, abertura/fechamento e Final Boss no fim.
  const orderedIds = arrangeSetlist(picked.map(toArrange));

  return {
    orderedIds,
    totalSeg: picked.reduce((t, s) => t + dur(s), 0),
  };
}
