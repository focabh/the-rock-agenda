"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contractorLinks } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

const MAX_DAYS = 365;

function newToken(): string {
  // dois UUIDs concatenados, sem hífen — ~256 bits de entropia, URL-safe.
  const a = globalThis.crypto.randomUUID().replace(/-/g, "");
  const b = globalThis.crypto.randomUUID().replace(/-/g, "");
  return a + b;
}

export async function createContractorLinkAction(input: {
  label?: string;
  days: number;
}) {
  const me = await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  await db
    .update(contractorLinks)
    .set({ revokedEm: new Date() })
    .where(eq(contractorLinks.id, id));
  revalidatePath("/contratantes");
  return { ok: true };
}

export async function deleteContractorLinkAction(id: string) {
  await requireAdmin();
  await db.delete(contractorLinks).where(eq(contractorLinks.id, id));
  revalidatePath("/contratantes");
  return { ok: true };
}
