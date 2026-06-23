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
await addCol("songs", "lyrics_manual", "INTEGER NOT NULL DEFAULT 0");
await addCol("songs", "voz_pedal", "TEXT");
await addCol("shows", "publico_perfil", "TEXT");
await addCol("songs", "cues", "TEXT");
await addCol("app_settings", "app_background_url", "TEXT");
await addCol("app_settings", "whatsapp_grupo_musicos", "TEXT");
await addCol("app_settings", "spotify_list_repertorio", "TEXT");
await addCol("app_settings", "spotify_list_setlist", "TEXT");
await addCol("app_settings", "spotify_list_ensaio", "TEXT");
await addCol("app_settings", "surface_opacity", "INTEGER NOT NULL DEFAULT 100");
await addCol("app_settings", "calendar_token", "TEXT");
await addCol("member_unavailability", "alternativas", "TEXT");
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

// pagamento por músico: override percentual (além do valor fixo já existente)
await addCol("show_member_payment", "pct", "REAL");
// default de pagamento por músico (valor fixo); o % usa percentual_divisao
await addCol("members", "pagamento_fixo_centavos", "INTEGER");
// funil de prospecção (kanban) das casas
await addCol("venues", "pipeline_stage", "TEXT");
// andamento (BPM) por música — metrônomo
await addCol("songs", "bpm", "INTEGER");
// posição no show (campo único): qualquer/abertura/bloco_inicial/bloco_final/encerramento
{
  const novo = !(await hasCol("songs", "posicao_show"));
  await addCol("songs", "posicao_show", "TEXT NOT NULL DEFAULT 'qualquer'");
  if (novo) {
    // Backfill do que já existia (momento + finalBoss) pra não perder marcação.
    await c.execute("UPDATE songs SET posicao_show = 'encerramento' WHERE final_boss = 1");
    await c.execute("UPDATE songs SET posicao_show = 'abertura' WHERE final_boss = 0 AND momento = 'abertura'");
    await c.execute("UPDATE songs SET posicao_show = 'bloco_final' WHERE final_boss = 0 AND momento = 'fechamento'");
    await c.execute("UPDATE songs SET posicao_show = 'bloco_inicial' WHERE final_boss = 0 AND momento = 'meio'");
    console.log("  ↳ backfill posicao_show a partir de momento/final_boss");
  }
}

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

await c.execute(`CREATE TABLE IF NOT EXISTS show_substitute (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  for_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  contato TEXT,
  funcao TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
)`);
console.log("= show_substitute (ok)");

// --- invariantes ---
await c.execute("UPDATE users SET superuser = 0 WHERE username != 'focabh'"); // só focabh é superadmin
console.log("\nMigração concluída.");
