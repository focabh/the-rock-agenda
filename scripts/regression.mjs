// Regressão E2E offline (precisa do dev/preview em :3000 + sessão do _seal).
// Roda os 3 cenários de palco e resume pass/fail.
import { execSync } from "node:child_process";

const tests = [
  ["Leitura offline — letras do snapshot", "node scripts/_chkoffline_lyrics.mjs"],
  ["Navegação offline — página do cache", "node scripts/_chkoffline_nav.mjs"],
  ["Escrita offline — fila + sync + persistência", "node scripts/_chkoffline_write.mjs"],
];

let fail = 0;
for (const [name, cmd] of tests) {
  console.log(`\n▶ ${name}`);
  let out = "";
  let ok = false;
  try {
    out = execSync(cmd, { encoding: "utf8" });
    ok = /RESULT:\s*OK/.test(out);
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
    ok = false;
  }
  const last = out.trim().split("\n").filter(Boolean).slice(-1)[0] || "(sem saída)";
  console.log("   " + last);
  console.log("   " + (ok ? "✅ PASS" : "❌ FAIL"));
  if (!ok) fail++;
}

console.log(`\n=== E2E offline: ${tests.length - fail}/${tests.length} passaram ===`);
process.exit(fail ? 1 : 0);
