// One-off: cria show_song_feedback. Idempotente. Apague depois.
import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS show_song_feedback (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      publico_curtiu INTEGER NOT NULL DEFAULT 0,
      banda_curtiu INTEGER NOT NULL DEFAULT 0,
      caiu INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_show_song_feedback ON show_song_feedback (show_id, song_id)`
  );
  console.log("OK: show_song_feedback pronta.");
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
}
