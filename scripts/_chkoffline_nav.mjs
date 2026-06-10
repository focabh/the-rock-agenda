import { chromium } from "playwright";
import { execSync } from "node:child_process";
const cookieVal = execSync("node scripts/_seal.mjs").toString().trim();
const ids = JSON.parse(execSync("node scripts/_ids.mjs").toString().trim());
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies([{ name: "therock_session", value: cookieVal, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
const p = await ctx.newPage();

// 1) registra o SW e espera ele assumir o controle
const ensaioUrl0 = `http://localhost:3000/ensaios/${ids.rehearsal}`;
await p.goto(ensaioUrl0, { waitUntil: "domcontentloaded", timeout: 120000 });
await p.evaluate(async () => { if ("serviceWorker" in navigator) await navigator.serviceWorker.ready; });
await p.waitForTimeout(1500);
// reload pra o SW controlar a navegação
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(1000);
const controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
console.log("SW controlling:", controlled);

// 2) visita as páginas de palco ONLINE (write-through as cacheia)
const ensaioUrl = `http://localhost:3000/ensaios/${ids.rehearsal}`;
await p.goto(ensaioUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForTimeout(1500);
await p.goto("http://localhost:3000/repertorio", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForTimeout(1500);

// 3) OFFLINE e renavega pra página já visitada
await ctx.setOffline(true);
console.log("offline = true");
let navOk = false, body = "";
try {
  await p.goto(ensaioUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  body = (await p.locator("body").innerText().catch(() => "")) || "";
  navOk = true;
} catch (e) {
  console.log("nav error:", String(e).split("\n")[0]);
}
const temConteudo = /Ensaio|Setlist|Presen/i.test(body);
const temErroBrowser = /ERR_INTERNET_DISCONNECTED|No internet|sem internet|n[ãa]o foi poss/i.test(body);
console.log("nav succeeded:", navOk, "| has stage content:", temConteudo, "| browser-offline-error:", temErroBrowser);
console.log("RESULT:", navOk && temConteudo && !temErroBrowser ? "OK — pagina do ensaio renderizou OFFLINE do cache" : "FALHOU");
console.log("trecho:", body.replace(/\s+/g, " ").trim().slice(0, 140));
await b.close();
