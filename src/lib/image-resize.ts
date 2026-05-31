// Aceita qualquer foto e redimensiona no cliente (canvas) antes de salvar —
// assim o usuário sobe fotos grandes sem barreira, e o que vai pro banco fica
// leve (data URL JPEG). Roda só no navegador.
export async function fileToDownscaledDataUrl(
  file: File,
  maxDim = 1600,
  quality = 0.85
): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    let { width, height } = img;
    const maior = Math.max(width, height);
    if (maior > maxDim) {
      const s = maxDim / maior;
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl; // se algo falhar, usa o original
  }
}
