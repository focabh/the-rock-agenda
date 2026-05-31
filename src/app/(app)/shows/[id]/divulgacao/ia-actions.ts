"use server";

import { requireCurrentUser } from "@/lib/auth";

/**
 * Recriação de arte por IA (img2img) a partir de um exemplo/template.
 *
 * Custo: ZERO no dia a dia — só roda se houver chave de API no ambiente.
 * Sem chave, devolve erro amigável e nada é cobrado.
 *
 * Provedores (nesta ordem de preferência):
 *  - OPENAI_API_KEY  → OpenAI Images (gpt-image-1, endpoint /images/edits)
 *  - FAL_KEY         → fal.ai (Flux img2img)
 *
 * IMPORTANTE: a assinatura do ChatGPT (Plus/Pro) NÃO serve aqui — é preciso
 * uma conta de API (platform.openai.com) com crédito, cobrada por uso. É
 * separada da assinatura.
 */

export type GerarIAResult =
  | { ok: true; imagens: string[] }
  | { ok: false; erro: string; precisaKey?: boolean };

const FAL_ENDPOINT = "https://fal.run/fal-ai/flux/dev/image-to-image";

export async function gerarImagemIAAction(
  exemploDataUrl: string,
  prompt: string,
  quantidade = 3
): Promise<GerarIAResult> {
  await requireCurrentUser();

  const openai = process.env.OPENAI_API_KEY?.trim();
  const fal = process.env.FAL_KEY?.trim();

  if (!openai && !fal) {
    return {
      ok: false,
      precisaKey: true,
      erro:
        "Geração automática por IA não está ligada. Configure OPENAI_API_KEY (conta de API da OpenAI, separada da assinatura do ChatGPT) ou FAL_KEY na Vercel. Enquanto isso, use 'Gerar no ChatGPT' (grátis) ou 'Usar como fundo'.",
    };
  }

  if (!exemploDataUrl?.startsWith("data:image/")) {
    return { ok: false, erro: "Envie uma imagem de exemplo válida." };
  }

  const n = Math.max(1, Math.min(quantidade, 3));
  const promptFinal =
    prompt?.trim() ||
    "modern concert flyer poster, bold typography space, high contrast, vibrant, instagram style, no text";

  try {
    if (openai) return await viaOpenAI(openai, exemploDataUrl, promptFinal, n);
    return await viaFal(fal!, exemploDataUrl, promptFinal, n);
  } catch {
    return { ok: false, erro: "Falha ao gerar com IA. Verifique a chave de API e tente de novo." };
  }
}

async function viaOpenAI(key: string, dataUrl: string, prompt: string, n: number): Promise<GerarIAResult> {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const blob = new Blob([Buffer.from(b64, "base64")], { type: mime });

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", "1024x1536"); // retrato ~9:16
  form.append("quality", "low"); // mais barato
  form.append("n", String(n));
  form.append("image", blob, `ref.${ext}`);

  const r = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return { ok: false, erro: `OpenAI ${r.status}: ${txt.slice(0, 160)}` };
  }
  const j = await r.json();
  const imagens: string[] = (j?.data ?? [])
    .map((d: { b64_json?: string; url?: string }) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url))
    .filter(Boolean);
  if (imagens.length === 0) return { ok: false, erro: "A IA não retornou imagens. Tente de novo." };
  return { ok: true, imagens };
}

async function viaFal(key: string, dataUrl: string, prompt: string, n: number): Promise<GerarIAResult> {
  const calls = Array.from({ length: n }, (_, i) =>
    fetch(FAL_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: dataUrl,
        prompt,
        strength: 0.6 + i * 0.1,
        num_inference_steps: 28,
        image_size: "portrait_16_9",
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`fal ${res.status}`);
      const j = await res.json();
      const url: string | undefined = j?.images?.[0]?.url;
      if (!url) throw new Error("sem imagem");
      return url;
    })
  );
  const settled = await Promise.allSettled(calls);
  const imagens = settled
    .filter((s): s is PromiseFulfilledResult<string> => s.status === "fulfilled")
    .map((s) => s.value);
  if (imagens.length === 0) return { ok: false, erro: "A IA não retornou imagens. Tente de novo." };
  return { ok: true, imagens };
}
