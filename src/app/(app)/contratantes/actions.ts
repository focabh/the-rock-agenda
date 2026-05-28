"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contractorLinks } from "@/db/schema";
import { requireCurrentUser } from "@/lib/auth";

const MAX_DAYS = 365;

const TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function newToken(): string {
  // 10 chars base62 = ~59 bits de entropia. Pra link com 10 dias de
  // validade e que o admin pode revogar a qualquer hora, sobra
  // entropia. Bruteforce em janela tão curta é inviável.
  // (O viés do % 62 é irrelevante pra esse modelo de ameaça.)
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += TOKEN_ALPHABET[bytes[i] % 62];
  return s;
}

/** Confere se quem chama pode mexer no link (criou ele ou é admin). */
async function ensureCanManage(id: string) {
  const me = await requireCurrentUser();
  if (me.role === "admin") return me;
  const [row] = await db
    .select({ createdBy: contractorLinks.createdBy })
    .from(contractorLinks)
    .where(eq(contractorLinks.id, id))
    .limit(1);
  if (!row) throw new Error("Link não encontrado.");
  if (row.createdBy !== me.id) {
    throw new Error("Você só pode mexer nos links que você criou.");
  }
  return me;
}

export async function createContractorLinkAction(input: {
  label?: string;
  days: number;
}) {
  const me = await requireCurrentUser();
  const days = Math.max(1, Math.min(MAX_DAYS, Math.floor(input.days || 10)));
  const expiresEm = new Date(Date.now() + days * 86_400_000);
  const token = newToken();
  await db.insert(contractorLinks).values({
    token,
    label: input.label?.trim() || null,
    expiresEm,
    createdBy: me.id,
  });
  revalidatePath("/contratantes");
  return { ok: true, token };
}

export async function extendContractorLinkAction(id: string, days: number) {
  await ensureCanManage(id);
  const d = Math.max(1, Math.min(MAX_DAYS, Math.floor(days || 10)));
  const expiresEm = new Date(Date.now() + d * 86_400_000);
  await db
    .update(contractorLinks)
    .set({ expiresEm, revokedEm: null })
    .where(eq(contractorLinks.id, id));
  revalidatePath("/contratantes");
  return { ok: true };
}

export async function revokeContractorLinkAction(id: string) {
  await ensureCanManage(id);
  await db
    .update(contractorLinks)
    .set({ revokedEm: new Date() })
    .where(eq(contractorLinks.id, id));
  revalidatePath("/contratantes");
  return { ok: true };
}

export async function deleteContractorLinkAction(id: string) {
  await ensureCanManage(id);
  await db.delete(contractorLinks).where(eq(contractorLinks.id, id));
  revalidatePath("/contratantes");
  return { ok: true };
}
