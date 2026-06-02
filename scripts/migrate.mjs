// Migração idempotente: traz o banco (Turso) até o schema atual. Pode rodar
// quantas vezes quiser. É a ÚNICA fonte de "ALTER TABLE" ad-hoc do projeto —
// consolida o que antes eram vários scripts soltos.
//
//   node scripts/migrate.mjs
//
import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.local" });

const c = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function hasCol(table, col) {
  const r = await c.execute(`PRAGMA table_info(${table})`);
  return r.rows.some((row) => row.name === col);
}
async function addCol(table, col, def) {
  if (await hasCol(table, col)) return console.log(`= ${table}.${col} (ok)`);
  await c.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  console.log(`+ ${table}.${col}`);
}

// --- colunas adicionadas ao longo do projeto ---
await addCol("songs", "prioridade", "INTEGER NOT NULL DEFAULT 0");
await addCol("songs", "synced_lyrics", "TEXT");
await addCol("songs", "cues", "TEXT");
await addCol("app_settings", "app_background_url", "TEXT");
await addCol("app_settings", "whatsapp_grupo_musicos", "TEXT");
await addCol("app_settings", "spotify_list_repertorio", "TEXT");
await addCol("app_settings", "spotify_list_setlist", "TEXT");
await addCol("app_settings", "spotify_list_ensaio", "TEXT");
await addCol("app_settings", "surface_opacity", "INTEGER NOT NULL DEFAULT 100");
await addCol("users", "superuser", "INTEGER NOT NULL DEFAULT 0");
await addCol("setlist_items", "emenda", "INTEGER NOT NULL DEFAULT 0");
await addCol("setlists", "oficial", "INTEGER NOT NULL DEFAULT 0");
await addCol("shows", "privado", "INTEGER NOT NULL DEFAULT 0");
await addCol("rehearsals", "show_id", "TEXT REFERENCES shows(id) ON DELETE SET NULL");

// cobrança de presença (lembretes automáticos)
for (const t of ["shows", "rehearsals"]) {
  await addCol(t, "lembrete_nivel", "TEXT NOT NULL DEFAULT 'off'");
  await addCol(t, "lembrete_enviado_em", "INTEGER");
  await addCol(t, "lembretes_enviados", "INTEGER NOT NULL DEFAULT 0");
}
await addCol("show_member_presence", "via_push", "INTEGER NOT NULL DEFAULT 0");
await addCol("rehearsal_member_presence", "via_push", "INTEGER NOT NULL DEFAULT 0");

// --- tabelas ---
await c.execute(`CREATE TABLE IF NOT EXISTS show_song_feedback (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  publico_curtiu INTEGER NOT NULL DEFAULT 0,
  banda_curtiu INTEGER NOT NULL DEFAULT 0,
  caiu INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
)`);
await c.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_show_song_feedback ON show_song_feedback (show_id, song_id)`);
console.log("= show_song_feedback (ok)");

// --- invariantes ---
await c.execute("UPDATE users SET superuser = 0 WHERE username != 'focabh'"); // só focabh é superadmin
console.log("\nMigração concluída.");
