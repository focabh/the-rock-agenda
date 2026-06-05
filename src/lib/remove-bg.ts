// Remove o fundo BRANCO de uma logo (típico de print do Instagram), no próprio
// navegador — sem custo, sem API. Estratégia: flood-fill a partir das BORDAS
// sobre pixels quase-brancos. Assim só o fundo (conectado às bordas) vira
// transparente; brancos DENTRO da logo (texto, detalhes) são preservados.
// Um feather leve nas bordas do recorte mata o halo branco.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não consegui carregar a imagem."));
    img.src = src;
  });
}

export async function removeWhiteBackground(
  dataUrl: string,
  opts: { threshold?: number } = {}
): Promise<string> {
  // Canais >= threshold (em 0–255) contam como "branco de fundo".
  const threshold = opts.threshold ?? 238;
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Imagem inválida.");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.drawImage(img, 0, 0, w, h);

  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;

  const isBgWhite = (i: number) =>
    d[i + 3] > 0 && d[i] >= threshold && d[i + 1] >= threshold && d[i + 2] >= threshold;

  // BFS a partir das 4 bordas.
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (!isBgWhite(p * 4)) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    d[p * 4 + 3] = 0; // transparente
    const x = p % w;
    const y = (p / w) | 0;
    seed(x + 1, y);
    seed(x - 1, y);
    seed(x, y + 1);
    seed(x, y - 1);
  }

  // Feather: pixels claros encostados no recorte ficam semi-transparentes
  // (quanto mais claro, mais transparente) — tira o anel branco da borda.
  const soft = threshold - 32;
  const alpha = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = d[p * 4 + 3];
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (d[i + 3] === 0) continue;
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < soft) continue;
    const x = p % w;
    const y = (p / w) | 0;
    let borda = false;
    if (x + 1 < w && d[(p + 1) * 4 + 3] === 0) borda = true;
    else if (x - 1 >= 0 && d[(p - 1) * 4 + 3] === 0) borda = true;
    else if (y + 1 < h && d[(p + w) * 4 + 3] === 0) borda = true;
    else if (y - 1 >= 0 && d[(p - w) * 4 + 3] === 0) borda = true;
    if (!borda) continue;
    const a = Math.round(255 - ((lum - soft) / (255 - soft)) * 255);
    alpha[p] = Math.min(alpha[p], Math.max(0, a));
  }
  for (let p = 0; p < w * h; p++) d[p * 4 + 3] = alpha[p];

  ctx.putImageData(id, 0, 0);
  return canvas.toDataURL("image/png");
}
