"use server";

import { requireCurrentUser } from "@/lib/auth";

/**
 * Recriação de arte por IA (img2img) a partir de um exemplo/template.
 *
 * Custo: ZERO no dia a dia — só roda se houver FAL_KEY no ambiente. Sem key,
 * devolve erro amigável e nada é cobrado.
 *
 * Provedor: fal.ai (Flux img2img). A key NÃO é a da Anthropic; é uma conta de
 * geração de imagem separada. Para ligar: definir FAL_KEY nas envs da Vercel.
 */

export type GerarIAResult =
  | { ok: true; imagens: string[] }
  | { ok: false; erro: string; precisaKey?: boolean };

const ENDPOINT = "https://fal.run/fal-ai/flux/dev/image-to-image";

export async function gerarImagemIAAction(
  exemploDataUrl: string,
  prompt: string,
  quantidade = 3
): Promise<GerarIAResult> {
  await requireCurrentUser();

  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      precisaKey: true,
      erro:
        "Recriação por IA não está ligada. Configure a env FAL_KEY (conta fal.ai) na Vercel para habilitar. Enquanto isso, use 'Usar exemplo como fundo' ou os modelos grátis.",
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
    const calls = Array.from({ length: n }, (_, i) =>
      fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: exemploDataUrl,
          prompt: promptFinal,
          strength: 0.6 + i * 0.1, // varia entre as 3 gerações
          num_inference_steps: 28,
          image_size: "portrait_16_9",
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`fal ${r.status}`);
        const j = await r.json();
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
  } catch {
    return { ok: false, erro: "Falha ao gerar com IA. Verifique a FAL_KEY e tente de novo." };
  }
}
