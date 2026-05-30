// Ajuste de duração do setlist: pega a ordem montada (pela IA ou pela
// heurística) e garante que o tempo total bate o alvo — completa com as
// melhores músicas sobrando se faltou, apara do meio se passou. Sempre
// preserva a 1ª música, a última e os Final Boss. Função PURA (testável).

export const SONG_DEFAULT_SEG = 210; // 3min30 quando a música não tem duração

export type FitSong = {
  id: string;
  status: string;
  duracaoSeg: number | null;
  energia: number | null;
  conhecida: boolean;
  finalBoss: boolean;
};

export const songSeg = (s?: { duracaoSeg: number | null }) =>
  s?.duracaoSeg && s.duracaoSeg > 0 ? s.duracaoSeg : SONG_DEFAULT_SEG;

export function fitToTarget(
  orderedIds: string[],
  allSongs: FitSong[],
  targetSeg: number
): { ids: string[]; totalSeg: number; faltou: boolean } {
  const byId = new Map(allSongs.map((s) => [s.id, s]));
  const sum = (ids: string[]) =>
    ids.reduce((t, id) => t + songSeg(byId.get(id)), 0);
  const tol = SONG_DEFAULT_SEG / 2; // tolerância de ~meia música
  const result = [...orderedIds];
  let cur = sum(result);

  // Passou do tempo: remove do meio (penúltima que não seja Final Boss).
  if (cur > targetSeg + tol) {
    let guard = result.length * 2;
    while (cur > targetSeg + tol && result.length > 2 && guard-- > 0) {
      let idx = result.length - 2; // nunca mexe na última (fechamento)
      while (idx > 0 && byId.get(result[idx])?.finalBoss) idx--;
      if (idx <= 0) break; // só restou abertura + fechamento
      cur -= songSeg(byId.get(result[idx]));
      result.splice(idx, 1);
    }
    return { ids: result, totalSeg: cur, faltou: false };
  }

  // Já está dentro da margem.
  if (cur >= targetSeg - tol) return { ids: result, totalSeg: cur, faltou: false };

  // Faltou tempo: completa com elegíveis ainda não usadas (melhores primeiro).
  const inSet = new Set(result);
  const unused = allSongs
    .filter(
      (s) =>
        !inSet.has(s.id) &&
        s.status !== "aposentada" &&
        s.status !== "ideia_futura"
    )
    .sort(
      (a, b) =>
        Number(b.conhecida) + (b.energia ?? 2) -
        (Number(a.conhecida) + (a.energia ?? 2))
    );

  // Insere antes do bloco final (Final Boss) ou antes da última (fechamento).
  let insertAt = result.length;
  while (insertAt > 0 && byId.get(result[insertAt - 1])?.finalBoss) insertAt--;
  if (insertAt === result.length && result.length > 0) insertAt = result.length - 1;
  if (insertAt < 0) insertAt = 0;

  for (const s of unused) {
    if (cur >= targetSeg - tol) break;
    result.splice(insertAt, 0, s.id);
    insertAt++;
    cur += songSeg(s);
  }
  return { ids: result, totalSeg: cur, faltou: cur < targetSeg - tol };
}
