import { chromium } from "playwright";
import { execSync } from "node:child_process";
const cookieVal = execSync("node scripts/_seal.mjs").toString().trim();
const ids = JSON.parse(execSync("node scripts/_ids.mjs").toString().trim());
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies([{ name: "therock_session", value: cookieVal, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
const p = await ctx.newPage();

// 1) ONLINE: carrega a página do ensaio (setlist renderiza "Ver letra" por item)
//    e deixa o snapshot popular o IndexedDB
await p.goto(`http://localhost:3000/ensaios/${ids.rehearsal}`, { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(2500);

// 2) OFFLINE de verdade
await ctx.setOffline(true);
console.log("context offline =", true);

// 3) abre a primeira letra disponível
const botoes = p.getByRole("button", { name: "Ver letra" });
const n = await botoes.count();
console.log("botoes 'Ver letra':", n);
if (n === 0) { console.log("RESULT: NENHUM botao de letra encontrado"); await b.close(); process.exit(0); }

// tenta achar uma música que tenha letra no snapshot: clica nos primeiros e vê
let achou = false;
for (let i = 0; i < Math.min(n, 8); i++) {
  await botoes.nth(i).click();
  await p.waitForTimeout(700);
  const dialog = p.getByRole("dialog");
  const txt = (await dialog.innerText().catch(() => "")) || "";
  const temErro = txt.includes("Erro ao buscar") || txt.includes("Buscando letra");
  const semLetra = txt.includes("não encontrada");
  // heurística: letra real = bastante texto e sem os estados de erro/loading
  const corpo = txt.replace(/\s+/g, " ").trim();
  if (!temErro && !semLetra && corpo.length > 120) {
    console.log(`RESULT: OK — letra exibida offline (botao #${i}). Trecho:`);
    console.log("   " + corpo.slice(0, 160) + "…");
    achou = true;
    await p.keyboard.press("Escape");
    break;
  }
  await p.keyboard.press("Escape");
  await p.waitForTimeout(250);
}
if (!achou) console.log("RESULT: nao consegui confirmar letra offline (talvez nenhuma das 8 primeiras tenha letra no snapshot)");
await b.close();
