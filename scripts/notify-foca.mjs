import { createClient } from "@libsql/client";
import webpush from "web-push";
import { config } from "dotenv";
config({ path: ".env.local" });

const TITLE = process.env.PUSH_TITLE || "The Rock 🤘";
const BODY = process.env.PUSH_BODY || "Atualização disponível — abra o app.";

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const users = await client.execute("SELECT id, username, role, nome, apelido FROM users");
const foca =
  users.rows.find((u) => /foca/i.test(`${u.username} ${u.nome} ${u.apelido}`)) ||
  users.rows.find((u) => u.username === "focabh") ||
  users.rows.find((u) => u.role === "admin");
if (!foca) { console.log("Foca não encontrado"); process.exit(0); }
const subs = await client.execute({ sql: "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", args: [foca.id] });
if (subs.rows.length === 0) { console.log("Foca sem inscrição de push"); process.exit(0); }

webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@therock.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
const payload = JSON.stringify({ title: TITLE, body: BODY, url: "/conta", tag: "update" });
let ok = 0;
for (const s of subs.rows) {
  try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); ok++; }
  catch (e) { console.log("falha:", e.statusCode || e.message); }
}
console.log(`Enviado a ${ok}/${subs.rows.length} dispositivos do Foca.`);
