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
import { fetchPlaceWebsite, instagramFromUrl, descobrirCasas, type CasaCandidata } from "@/lib/venue-places";

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

/** Lote: pra cada casa SEM logo, tenta (1) achar o @ no Google Places (site
 *  oficial → instagram) se ainda não tiver, e (2) puxar a logo do Instagram.
 *  Grátis (Places usa crédito do Google). Processa um lote por execução. */
export async function buscarLogosCasasAction(): Promise<{
  tentadas: number;
  ok: number;
  achouArroba: number;
  restantes: number;
}> {
  await requireAdmin();
  const rows = await db
    .select({ id: venues.id, instagram: venues.instagram, logoUrl: venues.logoUrl, nome: venues.nome, cidade: venues.cidade })
    .from(venues);
  const alvo = rows.filter((v) => !(v.logoUrl || "").trim());
  const lote = alvo.slice(0, 12);
  let ok = 0;
  let achouArroba = 0;
  for (const v of lote) {
    let ig = igHandle(v.instagram || "");
    if (!ig) {
      // tenta descobrir o @ pelo site oficial registrado no Google Places
      const arroba = instagramFromUrl(await fetchPlaceWebsite(v.nome, v.cidade));
      if (arroba) {
        ig = igHandle(arroba);
        await db.update(venues).set({ instagram: arroba }).where(eq(venues.id, v.id));
        achouArroba++;
      }
    }
    if (!ig) continue;
    const logo = await fetchInstagramLogo(ig);
    if (logo) {
      await db.update(venues).set({ logoUrl: logo }).where(eq(venues.id, v.id));
      ok++;
    }
  }
  revalidatePath("/casas");
  return { tentadas: lote.length, ok, achouArroba, restantes: alvo.length - lote.length };
}

/** Descobre casas perto que batem com o perfil (termo) + raio. */
export async function descobrirCasasAction(params: {
  lat: number;
  lng: number;
  raioM: number;
  termo: string;
}): Promise<{ candidatas: CasaCandidata[]; jaCadastradas: string[] }> {
  await requireAdmin();
  const candidatas = await descobrirCasas(params);
  const existentes = await db.select({ nome: venues.nome }).from(venues);
  const jaCadastradas = existentes.map((e) => e.nome.trim().toLowerCase());
  return { candidatas, jaCadastradas };
}

/** Adiciona uma casa descoberta (com @/logo se vier do Places). */
export async function adicionarCasaDescobertaAction(c: CasaCandidata): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!c.nome?.trim()) return { ok: false };
  let logoUrl: string | null = null;
  const ig = igHandle(c.instagram || "");
  if (ig) logoUrl = await fetchInstagramLogo(ig);
  await db.insert(venues).values({
    nome: c.nome.trim().slice(0, 120),
    endereco: c.endereco?.slice(0, 300) || null,
    latitude: c.lat ?? null,
    longitude: c.lng ?? null,
    instagram: c.instagram || null,
    logoUrl,
    querTocar: true, // descoberta = candidata pra tocar
  });
  revalidatePath("/casas");
  return { ok: true };
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
