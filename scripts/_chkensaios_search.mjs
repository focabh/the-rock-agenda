// E2E: navegação de "ensaios anteriores" (tela própria) + busca "por nome"
// trazendo a versão original. Precisa do app em :3000 + sessão (_seal).
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";

const cookieVal = execSync("node scripts/_seal.mjs").toString().trim();
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies([
  { name: "therock_session", value: cookieVal, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
]);
const p = await ctx.newPage();
fs.mkdirSync("resp-report", { recursive: true });

let fails = 0;
const check = (name, cond) => {
  console.log((cond ? "✅" : "❌") + " " + name);
  if (!cond) fails++;
};

// ---------- Ensaios: tela principal ----------
await p.goto("http://localhost:3000/ensaios", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(500);
const body1 = await p.locator("body").innerText();
const histLink = p.getByRole("link", { name: /Ver ensaios anteriores/i });
const detailsCount = await p.locator("details").count();
check("principal: tem link 'Ver ensaios anteriores'", (await histLink.count()) > 0);
check("principal: NÃO usa mais <details> 'Anteriores'", detailsCount === 0);
check("principal: descrição só fala de próximos", /Próximos ensaios/i.test(body1));
await p.screenshot({ path: "resp-report/_ensaios_main.png", fullPage: true });

// ---------- clica → histórico próprio ----------
if ((await histLink.count()) > 0) {
  await histLink.first().click();
  await p.waitForURL(/\/ensaios\/anteriores/, { timeout: 30000 });
  await p.waitForTimeout(400);
  const body2 = await p.locator("body").innerText();
  check("histórico: URL /ensaios/anteriores", p.url().includes("/ensaios/anteriores"));
  check("histórico: título 'Ensaios anteriores'", /Ensaios anteriores/i.test(body2));
  const back = p.getByRole("link", { name: /Voltar aos ensaios/i });
  check("histórico: link 'Voltar aos ensaios'", (await back.count()) > 0);
  await p.screenshot({ path: "resp-report/_ensaios_hist.png", fullPage: true });

  await back.first().click();
  await p.waitForURL(/\/ensaios$/, { timeout: 30000 });
  check("voltar: de volta em /ensaios", /\/ensaios$/.test(p.url()));
}

// ---------- Busca por nome → versão original ----------
await p.goto("http://localhost:3000/repertorio", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(500);
const addBtn = p.getByRole("button", { name: /Adicionar m[úu]sica/i });
if ((await addBtn.count()) > 0) {
  await addBtn.first().click();
  await p.getByText(/Por nome \(buscar\)/i).click();
  const input = p.getByPlaceholder(/zombie cranberries/i);
  await input.fill("creep radiohead");
  await p.waitForTimeout(4500); // deixa a fase 2 (catálogo) chegar
  const rows = p.locator("div.rounded-md.border p.font-medium");
  const first = ((await rows.first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  console.log("   1º resultado:", first);
  check("busca 'creep radiohead': 1º é do Radiohead", /radiohead/i.test(first));
  await p.screenshot({ path: "resp-report/_search_creep.png", fullPage: true });
} else {
  console.log("(botão 'Adicionar música' não encontrado — pulei o teste de busca)");
}

console.log("RESULT:", fails === 0 ? "OK" : `FALHOU (${fails})`);
await b.close();
process.exit(fails ? 1 : 0);
