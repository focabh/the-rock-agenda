"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { parseForm, type ActionState } from "@/lib/form";
import { requireAdmin } from "@/lib/auth";
import { maskPhone, telefoneValido } from "@/lib/validators";

const casaSchema = z.object({
  nome: z.string().min(1, "Obrigatório").max(120),
  cidade: z.string().max(80).optional(),
  bairro: z.string().max(80).optional(),
  endereco: z.string().max(300).optional(),
  estado: z.string().max(40).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  contatoPrincipal: z.string().max(80).optional(),
  telefone: z
    .string()
    .max(40)
    .optional()
    .refine(
      (v) => !v || !v.trim() || telefoneValido(v),
      "Telefone inválido — use DDD + número, ex: (31) 99999-9999"
    ),
  instagram: z.string().max(200).optional(),
  logoUrl: z.string().max(6_000_000).optional(),
  infraestrutura: z.string().max(2000).optional(),
  whatsappGrupo: z.string().max(300).optional(),
  observacoes: z.string().max(2000).optional(),
});

/** Tenta puxar a logo (foto de perfil) do Instagram da casa a partir do @,
 *  via unavatar.io (grátis, best-effort). Devolve data URL ou erro amigável. */
export async function buscarLogoInstagramAction(
  instagram: string
): Promise<{ ok: true; dataUrl: string } | { ok: false; erro: string }> {
  await requireAdmin();
  const handle = (instagram || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .trim();
  if (!handle) return { ok: false, erro: "Preencha o @ do Instagram primeiro." };
  try {
    const r = await fetch(`https://unavatar.io/instagram/${encodeURIComponent(handle)}?fallback=false`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) return { ok: false, erro: "Não achei a logo desse @ (o Instagram pode ter bloqueado). Envie a imagem à mão." };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 200) return { ok: false, erro: "Logo não encontrada nesse @." };
    if (buf.length > 4_000_000) return { ok: false, erro: "Imagem muito grande." };
    const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString("base64")}` };
  } catch {
    return { ok: false, erro: "Falha ao buscar. Tente de novo ou envie à mão." };
  }
}

/** Normaliza o telefone pra máscara padrão (ou null se vazio). */
function normalizeTelefone(tel?: string): string | null {
  const t = (tel ?? "").trim();
  return t ? maskPhone(t) : null;
}

export async function createCasaAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(casaSchema, formData);
  if (!parsed.ok) return parsed.state;

  await db
    .insert(venues)
    .values({ ...parsed.data, telefone: normalizeTelefone(parsed.data.telefone) });
  revalidatePath("/casas");
  redirect("/casas");
}

export async function updateCasaAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(casaSchema, formData);
  if (!parsed.ok) return parsed.state;

  await db
    .update(venues)
    .set({ ...parsed.data, telefone: normalizeTelefone(parsed.data.telefone) })
    .where(eq(venues.id, id));
  revalidatePath("/casas");
  revalidatePath(`/casas/${id}`);
  redirect("/casas");
}

export async function deleteCasaAction(id: string) {
  await requireAdmin();
  try {
    await db.delete(venues).where(eq(venues.id, id));
    revalidatePath("/casas");
  } catch (err) {
    return {
      error:
        "Não foi possível excluir — provavelmente há shows ligados a esta casa.",
    };
  }
}
