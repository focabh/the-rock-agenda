// Heurística simples (grátis, offline) pra sugerir afinação dropada (Drop D/C…).
// Não é exata — é um chute por artista/música. O admin pode marcar/desmarcar
// qualquer música depois. Usado pelo botão "Verificar drop" do repertório.

// Artistas em que afinação dropada/rebaixada é a norma na maior parte do catálogo.
const ARTISTAS_DROP = [
  "korn",
  "slipknot",
  "system of a down",
  "disturbed",
  "godsmack",
  "deftones",
  "mudvayne",
  "limp bizkit",
  "papa roach",
  "linkin park",
  "staind",
  "sevendust",
  "chevelle",
  "breaking benjamin",
  "three days grace",
  "seether",
  "nickelback",
  "shinedown",
  "five finger death punch",
  "rage against the machine",
  "audioslave",
  "drowning pool",
  "p.o.d",
  "bullet for my valentine",
  "avenged sevenfold",
  "trivium",
  "bring me the horizon",
  "a day to remember",
  "bush",
  "puddle of mudd",
  "theory of a deadman",
  "saliva",
  "rob zombie",
];

// Músicas específicas conhecidas por drop (mesmo de artistas em afinação padrão).
const MUSICAS_DROP = [
  "machinehead", // Bush — Drop D
  "machine head",
];

const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(COMBINING, "");

export function isLikelyDrop(titulo: string, artista: string): boolean {
  const a = norm(artista);
  if (ARTISTAS_DROP.some((x) => a.includes(x))) return true;
  const t = norm(titulo);
  if (MUSICAS_DROP.some((x) => t.includes(x))) return true;
  return false;
}
