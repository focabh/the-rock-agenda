// One-off: adiciona songs.prioridade (boolean, default 0). Idempotente.
import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function colExists(table, col) {
  const r = await client.execute(`PRAGMA table_info(${table})`);
  return r.rows.some((row) => row.name === col);
}

try {
  if (await colExists("songs", "prioridade")) {
    console.log("songs.prioridade já existe — nada a fazer.");
  } else {
    await client.execute(
      "ALTER TABLE songs ADD COLUMN prioridade INTEGER NOT NULL DEFAULT 0"
    );
    console.log("OK: songs.prioridade adicionada.");
  }
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
}
