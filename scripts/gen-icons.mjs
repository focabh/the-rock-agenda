// One-off: gera os ícones do PWA a partir de public/the-rock-logo.png.
// Rode com: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "public/the-rock-logo.png";
const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

// Fundo igual ao tema escuro do app (~ oklch(0.09) ≈ #171717).
const BG = { r: 23, g: 23, b: 23, alpha: 1 };

async function gen(size, pad, name) {
  const inner = Math.round(size * (1 - pad));
  const off = Math.round((size - inner) / 2);
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: BG })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, top: off, left: off }])
    .png()
    .toFile(`${OUT}/${name}`);
  console.log("✓", name);
}

await gen(192, 0.08, "icon-192.png");
await gen(512, 0.08, "icon-512.png");
await gen(512, 0.2, "icon-maskable.png"); // safe-zone maior p/ máscara circular
await gen(180, 0.08, "apple-touch-icon.png");
