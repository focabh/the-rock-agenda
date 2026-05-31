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

function igHandle(instagram: string): string {
  return (instagram || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .trim();
}

/** Busca a foto de perfil do Instagram via unavatar.io (grátis). null se falhar. */
async function fetchInstagramLogo(instagram: string): Promise<string | null> {
  const handle = igHandle(instagram);
  if (!handle) return null;
  try {
    const r = await fetch(`https://unavatar.io/instagram/${encodeURIComponent(handle)}?fallback=false`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 200 || buf.length > 4_000_000) return null;
    const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Tenta puxar a logo do Instagram da casa a partir do @ (best-effort). */
export async function buscarLogoInstagramAction(
  instagram: string
): Promise<{ ok: true; dataUrl: string } | { ok: false; erro: string }> {
  await requireAdmin();
  if (!igHandle(instagram)) return { ok: false, erro: "Preencha o @ do Instagram primeiro." };
  const dataUrl = await fetchInstagramLogo(instagram);
  if (!dataUrl) return { ok: false, erro: "Não achei a logo desse @ (o Instagram pode ter bloqueado). Envie a imagem à mão." };
  return { ok: true, dataUrl };
}

/** Lote: percorre as casas que têm @ e ainda não têm logo, e tenta puxar de
 *  cada uma (grátis). Limita por execução pra não estourar o tempo do servidor. */
export async function buscarLogosCasasAction(): Promise<{ tentadas: number; ok: number; restantes: number }> {
  await requireAdmin();
  const rows = await db
    .select({ id: venues.id, instagram: venues.instagram, logoUrl: venues.logoUrl })
    .from(venues);
  const alvo = rows.filter((v) => igHandle(v.instagram || "") && !(v.logoUrl || "").trim());
  const lote = alvo.slice(0, 25);
  let ok = 0;
  for (const v of lote) {
    const logo = await fetchInstagramLogo(v.instagram || "");
    if (logo) {
      await db.update(venues).set({ logoUrl: logo }).where(eq(venues.id, v.id));
      ok++;
    }
  }
  revalidatePath("/casas");
  return { tentadas: lote.length, ok, restantes: alvo.length - lote.length };
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

/** Liga/desliga flags da casa direto no card (já tocou, voltaria, etc.). */
export async function setCasaFlagAction(
  id: string,
  patch: { jaTocou?: boolean; voltaria?: boolean | null; querTocar?: boolean; naoContatar?: boolean }
): Promise<void> {
  await requireAdmin();
  await db.update(venues).set(patch).where(eq(venues.id, id));
  revalidatePath("/casas");
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
