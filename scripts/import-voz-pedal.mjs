// Importa a tabela de config do pedal de voz (Flamma FV-02) pro repertório,
// casando por título normalizado. Idempotente (re-rodar só re-aplica).
//   node scripts/import-voz-pedal.mjs
import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.local" });

const c = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function normalizeTitle(t) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TABLE = `
Aerials | 1 | RM | 15%
Alive | 5 | HL | 40%
Basket Case | 1 | RM | 25%
Black | 5 | HL | 35%
Come As You Are | 1 | RM | 20%
Even Flow | 1 | RM | 25%
How You Remind Me | 1 | RM | 30%
It's My Life | 1 | RM | 25%
Jeremy | 1 | RM | 25%
Killing In The Name | OFF | RM | 0%
Learn To Fly | 1 | RM | 25%
Like A Stone | 5 | HL | 40%
Losing My Religion | 1 | PL | 35%
Machinehead | OFF | RM | 0%
Man In The Box | 1 | RM | 20%
My Sacrifice | 5 | HL | 45%
No One Knows | 1 | RM | 20%
Otherside | 1 | PL | 20%
Roadhouse Blues | 1 | RM | 20%
Smells Like Teen Spirit | 1 | RM | 20%
The Kids Aren't Alright | 1 | RM | 20%
Whole Lotta Love | 1 | RM | 20%
Would? | 1 | RM | 20%
All Along The Watchtower | 1 | PL | 35%
Careless Whisper (Seether) | 5 | HL | 35%
Come Together (Godsmack) | 1 | RM | 20%
Enter Sandman | 1 | RM | 15%
Gimme Shelter | 1 | PL | 35%
Heart-Shaped Box | 1 | RM | 20%
Iris | 5 | HL | 40%
Livin' On A Prayer | 5 | HL | 35%
`;

function parseTable(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const cells = raw.split("|").map((x) => x.trim());
    if (cells.length < 4) continue;
    const [titulo, mode, reverb, level] = cells;
    rows.push({
      titulo,
      pedal: {
        mode: mode.toUpperCase(),
        reverb: reverb.toUpperCase(),
        level: Number(String(level).replace(/[^\d]/g, "")) || 0,
      },
    });
  }
  return rows;
}

const rows = parseTable(TABLE);
const songs = await c.execute("SELECT id, titulo FROM songs");
const byNorm = new Map(songs.rows.map((r) => [normalizeTitle(r.titulo), r.id]));

let applied = 0;
const notMatched = [];
for (const r of rows) {
  const id = byNorm.get(normalizeTitle(r.titulo));
  if (!id) {
    notMatched.push(r.titulo);
    continue;
  }
  await c.execute({
    sql: "UPDATE songs SET voz_pedal = ? WHERE id = ?",
    args: [JSON.stringify(r.pedal), id],
  });
  applied++;
}

console.log(`\nAplicadas: ${applied}/${rows.length}`);
if (notMatched.length) {
  console.log(`Não casaram (${notMatched.length}):`);
  for (const t of notMatched) console.log(`  - ${t}`);
} else {
  console.log("Todas casaram. ✅");
}
