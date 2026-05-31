"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { promoItems } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin } from "@/lib/auth";

const TIPOS = [
  "video",
  "foto",
  "logo",
  "presskit",
  "rider",
  "instagram",
] as const;
type Tipo = (typeof TIPOS)[number];

// Limites por tipo (boas práticas).
// - foto/logo: imagem (compressão JPEG já feita no cliente).
// - presskit/rider: PDF ou imagem.
// - instagram: só URL do perfil (instagram.com/...).
// max em bytes do data URL (já em base64, ~33% maior que o arquivo bruto).
const LIMITS: Record<
  Tipo,
  { max: number; sizeBytes: number; accept: RegExp }
> = {
  video: { max: 50, sizeBytes: 0, accept: /^https?:\/\// },
  foto: { max: 60, sizeBytes: 12_000_000, accept: /^(https?:\/\/|data:image\/)/ },
  logo: { max: 10, sizeBytes: 12_000_000, accept: /^(https?:\/\/|data:image\/)/ },
  presskit: {
    max: 1,
    sizeBytes: 14_000_000,
    accept: /^(https?:\/\/|data:application\/pdf|data:image\/)/,
  },
  rider: {
    max: 1,
    sizeBytes: 14_000_000,
    accept: /^(https?:\/\/|data:application\/pdf|data:image\/)/,
  },
  instagram: {
    max: 1,
    sizeBytes: 0,
    accept: /^https?:\/\/(?:www\.)?instagram\.com\//i,
  },
};

const SINGLETONS: Set<Tipo> = new Set(["presskit", "rider", "instagram"]);

const schema = z.object({
  tipo: z.enum(TIPOS),
  titulo: z.string().trim().min(2, "Informe um título").max(120),
  url: z.string().trim().min(1, "Informe o link ou anexe um arquivo").max(16_000_000),
  descricao: z.string().trim().max(500).optional(),
  cover: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || v.startsWith("data:image/"),
      "Capa inválida (use uma imagem)"
    )
    .refine((v) => !v || v.length < 2_000_000, "Capa muito grande (~1.5MB)"),
  removerCover: z.string().optional(),
});

function validateUrl(tipo: Tipo, url: string): string | null {
  const lim = LIMITS[tipo];
  if (!lim.accept.test(url)) {
    if (tipo === "video") return "Use um link público (YouTube, Vimeo, Drive...).";
    if (tipo === "instagram")
      return "Cole o link do perfil. Ex: https://www.instagram.com/sua.banda/";
    return "Use um link ou um arquivo válido para este tipo.";
  }
  if (url.startsWith("data:") && lim.sizeBytes > 0 && url.length > lim.sizeBytes) {
    const mb = Math.round(lim.sizeBytes / 1_000_000);
    return `Arquivo muito grande. Limite ~${mb}MB.`;
  }
  return null;
}

export async function createPromoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const { tipo, titulo, url, descricao, cover } = parsed.data;

  const urlErr = validateUrl(tipo, url);
  if (urlErr) return { fieldErrors: { url: [urlErr] }, error: urlErr };

  const existing = await db
    .select({ id: promoItems.id })
    .from(promoItems)
    .where(eq(promoItems.tipo, tipo));

  // Singletons: apaga o anterior e insere o novo.
  if (SINGLETONS.has(tipo) && existing.length > 0) {
    await db
      .delete(promoItems)
      .where(eq(promoItems.tipo, tipo));
  }

  // Limite por tipo.
  if (!SINGLETONS.has(tipo) && existing.length >= LIMITS[tipo].max) {
    return {
      error: `Limite de ${LIMITS[tipo].max} itens atingido. Remova algum antes.`,
    };
  }

  await db.insert(promoItems).values({
    tipo,
    titulo,
    url,
    descricao,
    cover: cover || null,
  });
  revalidatePath("/divulgacao");
  return null;
}

/** Sobe várias FOTOS de uma vez (data URLs já comprimidos no cliente). */
export async function createFotosBatchAction(
  urls: string[]
): Promise<{ ok: boolean; added: number; error?: string }> {
  await requireAdmin();
  const lim = LIMITS.foto;
  const validas = urls
    .filter((u) => lim.accept.test(u) && (!lim.sizeBytes || u.length <= lim.sizeBytes))
    .slice(0, 10); // máx 10 por vez
  if (validas.length === 0) return { ok: false, added: 0, error: "Nenhuma foto válida." };

  const existentes = await db
    .select({ id: promoItems.id })
    .from(promoItems)
    .where(eq(promoItems.tipo, "foto"));
  const espaco = Math.max(0, lim.max - existentes.length);
  if (espaco === 0)
    return { ok: false, added: 0, error: `Limite de ${lim.max} fotos atingido.` };

  const aInserir = validas.slice(0, espaco);
  let n = existentes.length;
  await db.insert(promoItems).values(
    aInserir.map((url) => ({ tipo: "foto" as const, titulo: `Foto ${++n}`, url }))
  );
  revalidatePath("/divulgacao");
  revalidatePath("/show");
  return { ok: true, added: aInserir.length };
}

export async function updatePromoAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const { tipo, titulo, url, descricao, cover, removerCover } = parsed.data;

  const urlErr = validateUrl(tipo, url);
  if (urlErr) return { fieldErrors: { url: [urlErr] }, error: urlErr };

  // Se o tipo mudou e o novo é singleton com outro existente, apaga o outro.
  if (SINGLETONS.has(tipo)) {
    await db
      .delete(promoItems)
      .where(and(eq(promoItems.tipo, tipo), ne(promoItems.id, id)));
  }

  const update: Record<string, unknown> = { tipo, titulo, url, descricao };
  if (removerCover === "1") update.cover = null;
  else if (cover) update.cover = cover;
  // se nem cover nem removerCover, mantém o atual.

  await db
    .update(promoItems)
    .set(update)
    .where(eq(promoItems.id, id));
  revalidatePath("/divulgacao");
  return null;
}

export async function deletePromoAction(id: string) {
  await requireAdmin();
  await db.delete(promoItems).where(eq(promoItems.id, id));
  revalidatePath("/divulgacao");
}

/** Marca/desmarca o material como "enviar sempre" (incluído em toda divulgação). */
export async function togglePromoObrigatorioAction(
  id: string,
  obrigatorio: boolean
) {
  await requireAdmin();
  await db
    .update(promoItems)
    .set({ obrigatorio })
    .where(eq(promoItems.id, id));
  revalidatePath("/divulgacao");
  revalidatePath("/casas");
  return { ok: true };
}
