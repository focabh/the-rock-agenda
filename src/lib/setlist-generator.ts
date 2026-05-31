// Gerador de setlist: combina duração do show + perfil/tags da casa + metadados
// das músicas. Função PURA e determinística (recebe seed) — fácil de testar.
// É só uma SUGESTÃO inicial; o usuário ajusta tudo manualmente depois.

export type GenSong = {
  id: string;
  status: string;
  duracaoSeg: number | null;
  energia: number | null; // 1 leve .. 3 pesada
  conhecida: boolean;
  exigeVocal: boolean;
  momento: string; // qualquer|abertura|meio|fechamento
  finalBoss?: boolean; // hino/munição pesada → vai pro fim, nunca no início
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

  const eligible = songs.filter(
    (s) => s.status !== "aposentada" && s.status !== "ideia_futura"
  );

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

  // Seleciona até preencher o tempo-alvo (tolera ultrapassar com a última).
  const picked: GenSong[] = [];
  let total = 0;
  for (const { s } of scored) {
    if (total >= o.targetSeg) break;
    picked.push(s);
    total += dur(s);
  }

  const ordered = orderSetlistCurve(picked);

  return {
    orderedIds: ordered.map((s) => s.id),
    totalSeg: ordered.reduce((t, s) => t + dur(s), 0),
  };
}

/**
 * Ordena um conjunto de músicas numa curva de energia: abertura → meio
 * (energia ascendente) → fechamento → Final Boss (munição pesada no fim).
 * Não adiciona nem remove nada — só reorganiza. Usado tanto na geração quanto
 * no "Aplicar melhorias" (reorganizar o set atual). PURA.
 */
export function orderSetlistCurve(picked: GenSong[]): GenSong[] {
  const energy = (s: GenSong) => s.energia ?? 2;
  const fb = picked.filter((s) => s.finalBoss);
  const rest = picked.filter((s) => !s.finalBoss);
  const abertura = rest.filter((s) => s.momento === "abertura");
  const fechamento = rest.filter((s) => s.momento === "fechamento");
  const meio = rest.filter(
    (s) => s.momento !== "abertura" && s.momento !== "fechamento"
  );
  // Energia subindo (começa mais leve, fecha mais forte).
  meio.sort((a, b) => energy(a) - energy(b));

  const ordered = [...abertura, ...meio, ...fechamento, ...fb];

  // Sem fechamento NEM Final Boss: garante um final forte (maior energia).
  if (fechamento.length === 0 && fb.length === 0 && ordered.length > 1) {
    let bestIdx = 0;
    let best = -Infinity;
    ordered.forEach((s, i) => {
      const v = energy(s) + (s.conhecida ? 0.5 : 0);
      if (v > best) {
        best = v;
        bestIdx = i;
      }
    });
    const [closer] = ordered.splice(bestIdx, 1);
    ordered.push(closer);
  }

  return ordered;
}
