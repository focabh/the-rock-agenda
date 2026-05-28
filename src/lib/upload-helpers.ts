// Helpers de upload usados por componentes "use client" (usam APIs do navegador).
// Não importe daqui em código que roda no servidor.

/** Lê um arquivo como data URL, comprimindo imagens grandes via canvas. */
export async function fileToDataUrl(file: File): Promise<string> {
  const readRaw = () =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  if (!file.type.startsWith("image/")) return readRaw(); // PDF etc.

  const dataUrl = await readRaw();
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const maxDim = 1400;
  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.75);
}
