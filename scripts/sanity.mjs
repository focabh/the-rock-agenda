// Sanity/smoke: confirma que o app sobe e as rotas-chave respondem (precisa do
// dev/preview rodando em :3000 + sessão do _seal). Não muda dados.
import { execSync } from "node:child_process";

const base = process.env.BASE_URL || "http://localhost:3000";
const cookie = execSync("node scripts/_seal.mjs").toString().trim();
const H = { Cookie: `therock_session=${cookie}` };

let fail = 0;
function report(name, ok, info) {
  console.log(`${ok ? "✅" : "❌"} ${name}${info ? "  " + info : ""}`);
  if (!ok) fail++;
}

// snapshot offline — coração da leitura offline
{
  const res = await fetch(base + "/api/offline/snapshot", { headers: H });
  let j = null;
  try { j = res.ok ? await res.json() : null; } catch { /* */ }
  const ok = res.status === 200 && j && Array.isArray(j.songs) && Array.isArray(j.setlists) && typeof j.version === "number";
  report("/api/offline/snapshot", ok, `status=${res.status} songs=${j?.songs?.length} setlists=${j?.setlists?.length}`);
}

// páginas autenticadas (devem dar 200; sem sessão dariam 307 → /login)
for (const path of ["/", "/repertorio", "/ensaios", "/shows", "/agenda", "/agenda/importar", "/modo-show", "/financeiro", "/gastos", "/gastos/importar", "/pagamentos"]) {
  const res = await fetch(base + path, { headers: H, redirect: "manual" });
  report(path, res.status === 200, `status=${res.status}`);
}

// login público (sem auth) deve responder 200
{
  const res = await fetch(base + "/login", { redirect: "manual" });
  report("/login (sem auth)", res.status === 200, `status=${res.status}`);
}

console.log(`\n=== sanity: ${fail === 0 ? "OK" : "FALHOU"} (${fail} falha(s)) ===`);
process.exit(fail ? 1 : 0);
