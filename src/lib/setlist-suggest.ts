// Sugestões de ajuste de setlist (NÃO-destrutivo): dado o setlist atual + o
// repertório disponível + o tempo-alvo, devolve sugestões de remover/adicionar/
// trocar — com motivo. Função PURA e determinística (fácil de testar). Quem
// aplica é o usuário (cada sugestão tem um "aplicar" opcional na UI).

export type SuggestSong = {
  songId: string;
  titulo: string;
  artista: string;
  duracaoSeg: number | null;
  status: string; // pronta | precisa_ensaiar | aprendendo | ideia_futura | aposentada
  energia: number | null; // 1 leve .. 3 pesada
  favorita?: boolean;
  finalBoss?: boolean;
};

export type Suggestion =
  | { kind: "remove"; songId: string; titulo: string; reason: string }
  | { kind: "add"; songId: string; titulo: string; reason: string }
  | {
      kind: "swap";
      removeSongId: string;
      removeTitulo: string;
      addSongId: string;
      addTitulo: string;
      reason: string;
    };

const DEFAULT_DUR = 210; // 3min30 quando a música não tem duração
const TRANSITION = 10; // ~10s de palco por música
const dur = (s: SuggestSong) =>
  s.duracaoSeg && s.duracaoSeg > 0 ? s.duracaoSeg : DEFAULT_DUR;
const energy = (s: SuggestSong) => s.energia ?? 2;

// Quanto maior, mais "pronta"/forte (remove as de menor rank primeiro).
const READY_RANK: Record<string, number> = {
  pronta: 3,
  precisa_ensaiar: 2,
  aprendendo: 1,
  ideia_futura: 0,
  aposentada: 0,
};
const rank = (s: SuggestSong) => READY_RANK[s.status] ?? 1;

/** Duração total estimada do setlist (com transições). */
export function setlistTotalSeg(set: SuggestSong[]): number {
  return set.reduce((t, s) => t + dur(s) + TRANSITION, 0);
}

function fmtMin(sec: number): string {
  const m = Math.round(Math.abs(sec) / 60);
  return `${m}min`;
}

/**
 * Gera as sugestões. `targetSeg` = tempo-alvo do repertório (segundos).
 * Ordem: trocas por prontidão → ajuste de tempo (remover se passou / adicionar
 * se faltou). Limita a quantidade pra não virar uma parede de texto.
 */
export function suggestSetlistChanges(
  set: SuggestSong[],
  pool: SuggestSong[],
  targetSeg: number
): Suggestion[] {
  const out: Suggestion[] = [];
  const usedFromPool = new Set<string>();
  const removedFromSet = new Set<string>();

  // Pool elegível: nada aposentado/ideia; prioriza prontas/favoritas.
  const poolOk = pool
    .filter((s) => s.status !== "aposentada" && s.status !== "ideia_futura")
    .sort(
      (a, b) =>
        rank(b) - rank(a) ||
        Number(!!b.favorita) - Number(!!a.favorita) ||
        a.titulo.localeCompare(b.titulo)
    );

  // 1) SUBSTITUIÇÕES por prontidão: música fraca no set ↔ pronta no pool com
  //    energia parecida. Independe do tempo (não muda a duração). Máx 3.
  const fracas = set
    .filter((s) => rank(s) < 3 && !s.finalBoss)
    .sort((a, b) => rank(a) - rank(b));
  for (const f of fracas) {
    if (out.filter((s) => s.kind === "swap").length >= 3) break;
    const cand = poolOk.find(
      (p) =>
        p.status === "pronta" &&
        !usedFromPool.has(p.songId) &&
        Math.abs(energy(p) - energy(f)) <= 1
    );
    if (!cand) continue;
    usedFromPool.add(cand.songId);
    out.push({
      kind: "swap",
      removeSongId: f.songId,
      removeTitulo: f.titulo,
      addSongId: cand.songId,
      addTitulo: cand.titulo,
      reason: `“${f.titulo}” ainda está em ${labelStatus(f.status)}; “${cand.titulo}” está pronta e tem energia parecida.`,
    });
  }

  // 2) TEMPO. Recalcula considerando as trocas (mesma contagem, não muda total).
  const total = setlistTotalSeg(set);
  const diff = total - targetSeg; // >0 passou, <0 faltou

  if (diff > 75) {
    // Passou do tempo → sugere remover as mais fracas/curtas primeiro (sem
    // finalBoss), até voltar pra perto do alvo.
    const removiveis = [...set]
      .filter((s) => !s.finalBoss)
      .sort((a, b) => rank(a) - rank(b) || dur(a) - dur(b));
    let sobra = diff;
    for (const s of removiveis) {
      if (sobra <= 75) break;
      if (removedFromSet.has(s.songId)) continue;
      // Se essa música já é a parte "remove" de um swap, não duplica.
      if (out.some((o) => o.kind === "swap" && o.removeSongId === s.songId)) continue;
      removedFromSet.add(s.songId);
      out.push({
        kind: "remove",
        songId: s.songId,
        titulo: s.titulo,
        reason: `Setlist está ~${fmtMin(diff)} acima do alvo. Tirar “${s.titulo}” (${labelStatus(s.status)}, ~${fmtMin(dur(s))}) aproxima do tempo.`,
      });
      sobra -= dur(s) + TRANSITION;
    }
  } else if (diff < -90) {
    // Faltou tempo → sugere adicionar do pool (mais prontas/favoritas primeiro).
    let falta = -diff;
    for (const p of poolOk) {
      if (falta <= 60) break;
      if (usedFromPool.has(p.songId)) continue;
      usedFromPool.add(p.songId);
      out.push({
        kind: "add",
        songId: p.songId,
        titulo: p.titulo,
        reason: `Faltam ~${fmtMin(-diff)} pro alvo. Add “${p.titulo}” (${labelStatus(p.status)}, ~${fmtMin(dur(p))}).`,
      });
      falta -= dur(p) + TRANSITION;
    }
  }

  return out;
}

function labelStatus(s: string): string {
  return (
    {
      pronta: "pronta",
      precisa_ensaiar: "precisa ensaiar",
      aprendendo: "aprendendo",
      ideia_futura: "ideia",
      aposentada: "aposentada",
    }[s] ?? s
  );
}
