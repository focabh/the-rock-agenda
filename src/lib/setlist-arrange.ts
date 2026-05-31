// Arranjo de setlist (ordenação) com as restrições de palco do "mago":
//  1. Final Boss sempre no fim (hino/catarse), em energia ascendente entre eles.
//  2. Minimizar reafinações: agrupa as músicas DROPADAS juntas e as de afinação
//     normal juntas (não fica trocando pra drop o tempo todo).
//  3. Curva de energia: blocos ordenados por energia média ascendente (abre
//     leve, fecha forte); dentro do bloco, energia também sobe (respiros).
//  4. Intercalar artistas: proibido > 2 músicas seguidas do mesmo artista —
//     corrige por swap DENTRO do bloco (preserva o bloco contíguo).
//  5. Abertura/fechamento (`momento`): movem o BLOCO inteiro pro começo / fim.
// PURA e determinística (sem aleatoriedade) — testável isolada.

export type ArrangeSong = {
  id: string;
  dropada: boolean;
  artista: string;
  energia: number | null;
  momento: string; // qualquer|abertura|meio|fechamento
  conhecida: boolean;
  finalBoss: boolean;
};

const energyOf = (s: ArrangeSong) => s.energia ?? 2;
const tuneKey = (s: ArrangeSong) => (s.dropada ? "drop" : "std");

/** Quebra runs de > 2 do mesmo artista trocando por outro do MESMO bloco
 *  (mantém a afinação). Mutação in-place. */
function breakArtistRuns(list: ArrangeSong[]): void {
  for (let i = 2; i < list.length; i++) {
    if (
      list[i].artista &&
      list[i].artista === list[i - 1].artista &&
      list[i].artista === list[i - 2].artista
    ) {
      let best = -1;
      for (let j = i + 1; j < list.length; j++) {
        if (list[j].artista !== list[i].artista) {
          best = j;
          break;
        }
      }
      if (best === -1) {
        for (let j = i - 3; j >= 0; j--) {
          if (list[j].artista !== list[i].artista) {
            best = j;
            break;
          }
        }
      }
      if (best !== -1) {
        const [moved] = list.splice(best, 1);
        list.splice(i, 0, moved);
      }
    }
  }
}

type Block = { key: string; songs: ArrangeSong[] };

export function arrangeSetlist(picked: ArrangeSong[]): string[] {
  if (picked.length <= 1) return picked.map((s) => s.id);

  const fb = picked
    .filter((s) => s.finalBoss)
    .sort((a, b) => energyOf(a) - energyOf(b));
  const body = picked.filter((s) => !s.finalBoss);
  if (body.length === 0) return fb.map((s) => s.id);

  // 1) Agrupa por afinação → blocos. Dentro do bloco: energia asc + intercala
  //    artistas (sem sair do bloco).
  const groups = new Map<string, ArrangeSong[]>();
  for (const s of body) {
    const k = tuneKey(s);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }
  const blocks: Block[] = [...groups.entries()].map(([key, songs]) => {
    // Energia ascendente; empate → a mais "conhecida"/popular primeiro
    // (proxy de popularidade — desempate §3.2).
    const sorted = [...songs].sort(
      (a, b) =>
        energyOf(a) - energyOf(b) || Number(b.conhecida) - Number(a.conhecida)
    );
    breakArtistRuns(sorted);
    return { key, songs: sorted };
  });

  // 2) Ordena os blocos por energia média ascendente.
  const avg = (b: Block) =>
    b.songs.reduce((t, s) => t + energyOf(s), 0) / b.songs.length;
  blocks.sort((a, b) => avg(a) - avg(b));

  // 3) Abertura: o bloco que tem a música 'abertura' de menor energia vai pro
  //    começo, e essa música pra frente do bloco.
  const aberturaSong = body
    .filter((s) => s.momento === "abertura")
    .sort((a, b) => energyOf(a) - energyOf(b))[0];
  if (aberturaSong) {
    const bi = blocks.findIndex((b) => b.songs.some((s) => s.id === aberturaSong.id));
    if (bi > 0) blocks.unshift(blocks.splice(bi, 1)[0]);
    const blk = blocks[0];
    const si = blk.songs.findIndex((s) => s.id === aberturaSong.id);
    if (si > 0) blk.songs.unshift(blk.songs.splice(si, 1)[0]);
  }

  // 4) Fechamento: o bloco que tem música(s) 'fechamento' vai pro fim do corpo,
  //    e essas músicas pro fim do bloco.
  const temFechamento = body.some((s) => s.momento === "fechamento");
  if (temFechamento) {
    const bi = blocks.findIndex((b) =>
      b.songs.some((s) => s.momento === "fechamento")
    );
    if (bi !== -1 && bi !== blocks.length - 1) {
      blocks.push(blocks.splice(bi, 1)[0]);
    }
    const blk = blocks[blocks.length - 1];
    const fechs = blk.songs.filter((s) => s.momento === "fechamento");
    blk.songs = [
      ...blk.songs.filter((s) => s.momento !== "fechamento"),
      ...fechs,
    ];
  }

  const ordered = blocks.flatMap((b) => b.songs);
  return [...ordered, ...fb].map((s) => s.id);
}

/** Conta quantas vezes alterna entre drop/normal na ordem (mede reafinações). */
export function countRetunes(songs: ArrangeSong[], orderedIds: string[]): number {
  const byId = new Map(songs.map((s) => [s.id, s]));
  let changes = 0;
  let prev: string | null = null;
  for (const id of orderedIds) {
    const k = tuneKey(byId.get(id)!);
    if (prev !== null && k !== prev) changes++;
    prev = k;
  }
  return changes;
}
