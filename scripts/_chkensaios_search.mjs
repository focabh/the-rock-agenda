// E2E: navegação de "ensaios anteriores" (tela própria) + busca "por nome"
// (versão original + corridas da busca em 2 fases). Precisa do app em :3000 +
// sessão (_seal).
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

// Coleta erros/warnings de console + exceções (p/ validar corrida B).
const consoleIssues = [];
p.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") consoleIssues.push(`${m.type()}: ${m.text()}`);
});
p.on("pageerror", (e) => consoleIssues.push(`pageerror: ${String(e)}`));

let fails = 0;
const check = (name, cond) => {
  console.log((cond ? "✅" : "❌") + " " + name);
  if (!cond) fails++;
};
const firstRow = async () =>
  ((await p.locator("div.rounded-md.border p.font-medium").first().innerText().catch(() => "")) || "")
    .replace(/\s+/g, " ")
    .trim();

// ---------- Ensaios: tela principal ----------
await p.goto("http://localhost:3000/ensaios", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(500);
const body1 = await p.locator("body").innerText();
const histLink = p.getByRole("link", { name: /Ver ensaios anteriores/i });
check("principal: tem link 'Ver ensaios anteriores'", (await histLink.count()) > 0);
check("principal: NÃO usa mais <details> 'Anteriores'", (await p.locator("details").count()) === 0);
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

// ---------- Busca por nome ----------
await p.goto("http://localhost:3000/repertorio", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(500);
const addBtn = p.getByRole("button", { name: /Adicionar m[úu]sica/i });
if ((await addBtn.count()) > 0) {
  const openDialog = async () => {
    await addBtn.first().click();
    await p.getByText(/Por nome \(buscar\)/i).click();
    return p.getByPlaceholder(/zombie cranberries/i);
  };

  // (base) creep radiohead → Radiohead em 1º
  let input = await openDialog();
  await input.fill("creep radiohead");
  await p.waitForTimeout(4500);
  const creep = await firstRow();
  console.log("   creep radiohead 1º:", creep);
  check("busca 'creep radiohead': 1º é do Radiohead", /radiohead/i.test(creep));
  await p.screenshot({ path: "resp-report/_search_creep.png", fullPage: true });

  // (Corrida A) troca rápida: creep radiohead → wonderwall oasis. A resposta
  // tardia do 1º NUNCA pode sobrescrever o 2º.
  await input.fill("creep radiohead");
  await p.waitForTimeout(150);
  await input.fill("wonderwall oasis");
  await p.waitForTimeout(5000);
  const raceA = await firstRow();
  console.log("   corrida A 1º:", raceA);
  check("corrida A: 1º resultado é Wonderwall/Oasis (não creep)", /oasis/i.test(raceA) && !/radiohead/i.test(raceA));

  // (Corrida B) fecha o diálogo durante a fase 2 ("Buscando a versão original…").
  // Escopo: só interessa se o FECHAR gera erro de estado NOVO (setState em
  // desmontado / act / "Cannot update"). O #418 (hydration) é app-wide e
  // pré-existente na carga da página → fora do escopo desta checagem.
  await input.fill("zombie cranberries");
  await p.getByText(/Buscando a versão original/i).waitFor({ timeout: 4000 }).catch(() => {});
  const before = consoleIssues.length;
  await p.keyboard.press("Escape");
  await p.waitForTimeout(4500); // deixa a fase 2 tardia resolver (deve ser ignorada)
  const dialogClosed = (await p.getByPlaceholder(/zombie cranberries/i).count()) === 0;
  check("corrida B: diálogo fechou durante a fase 2", dialogClosed);

  const newIssues = consoleIssues.slice(before);
  const stateIssues = newIssues.filter((s) =>
    /unmounted|not wrapped in act|Cannot update|state update on an? unmounted/i.test(s)
  );
  if (stateIssues.length) console.log("   state issues (novos):", stateIssues.slice(0, 5));
  check("corrida B: fechar NÃO gerou erro de estado/desmontagem novo", stateIssues.length === 0);
  const pre418 = consoleIssues.filter((s) => /#418/.test(s)).length;
  console.log(`   (baseline app-wide #418 na carga: ${pre418} — pré-existente, fora do escopo)`);
} else {
  console.log("(botão 'Adicionar música' não encontrado — pulei o teste de busca)");
}

console.log("RESULT:", fails === 0 ? "OK" : `FALHOU (${fails})`);
await b.close();
process.exit(fails ? 1 : 0);
