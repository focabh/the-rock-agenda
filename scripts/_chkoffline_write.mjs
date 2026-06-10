import { chromium } from "playwright";
import { execSync } from "node:child_process";
const cookieVal = execSync("node scripts/_seal.mjs").toString().trim();
const ids = JSON.parse(execSync("node scripts/_ids.mjs").toString().trim());
const ensaioUrl = `http://localhost:3000/ensaios/${ids.rehearsal}`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies([{ name: "therock_session", value: cookieVal, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
const p = await ctx.newPage();

const log = (...a) => console.log(...a);
const readQueue = () => p.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open("rock-offline", 1);
  req.onsuccess = () => {
    const db = req.result;
    const t = db.transaction("queue", "readonly");
    const r = t.objectStore("queue").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve("ERR");
  };
  req.onerror = () => resolve("ERR");
}));

// 1) ONLINE: carrega ensaio, registra SW, popula snapshot
await p.goto(ensaioUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await p.evaluate(async () => { if ("serviceWorker" in navigator) await navigator.serviceWorker.ready; });
await p.waitForTimeout(2500);

// alvo: primeiro músico tocável (ativo && !isManager) por nome
const target = await p.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open("rock-offline", 1);
  req.onsuccess = () => {
    const db = req.result;
    const t = db.transaction("kv", "readonly");
    const r = t.objectStore("kv").get("snapshot");
    r.onsuccess = () => {
      const snap = r.result;
      const play = (snap?.members || []).filter((m) => m.ativo && !m.isManager).sort((a, b) => a.nome.localeCompare(b.nome));
      resolve(play[0] ? { id: play[0].id, nome: play[0].nome } : null);
    };
  };
}));
log("alvo (1º músico):", target);

// 2) OFFLINE → confirma presença do 1º músico
await ctx.setOffline(true);
log("offline = true");
const simBtns = p.getByRole("button", { name: "Sim" });
const nSim = await simBtns.count();
log("botoes 'Sim':", nSim);
await simBtns.first().click();
await p.waitForTimeout(800);
let q = await readQueue();
log("fila apos clique offline:", Array.isArray(q) ? q.length : q, Array.isArray(q) && q[0] ? `(kind=${q[0].kind}, label=${q[0].label})` : "");
const queuedOk = Array.isArray(q) && q.length >= 1 && q[0].kind === "setRehearsalPresence";

// 3) ONLINE → deve sincronizar a fila sozinho
await ctx.setOffline(false);
log("offline = false (reconectou)");
// espera a fila drenar (até ~15s)
let drained = false;
for (let i = 0; i < 15; i++) {
  await p.waitForTimeout(1000);
  q = await readQueue();
  if (Array.isArray(q) && q.length === 0) { drained = true; break; }
}
log("fila apos reconectar:", Array.isArray(q) ? q.length : q, "| drenou:", drained);

// 4) confirma no servidor: busca snapshot fresco e checa a presença do alvo
const serverOk = await p.evaluate(async (t) => {
  const res = await fetch("/api/offline/snapshot", { credentials: "same-origin" });
  const snap = await res.json();
  const row = (snap.rehearsalMemberPresence || []).find((x) => x.memberId === t.id);
  return { status: row?.status ?? null };
}, target);
log("presenca do alvo no servidor:", serverOk);

const pass = queuedOk && drained && serverOk.status === "confirmado";
log("RESULT:", pass ? "OK — escrita offline enfileirou, sincronizou e PERSISTIU no servidor" : "FALHOU");
await b.close();
process.exit(pass ? 0 : 1);
