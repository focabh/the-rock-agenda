"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, appSettings } from "@/db/schema";
import {
  hashPassword,
  requireAdmin,
  requireCurrentUser,
  verifyPassword,
} from "@/lib/auth";
import { parseForm, type ActionState } from "@/lib/form";

const passwordSchema = z
  .object({
    atual: z.string().min(1, "Informe a senha atual"),
    nova: z.string().min(6, "Mínimo 6 caracteres").max(100),
    confirmar: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.nova === d.confirmar, {
    path: ["confirmar"],
    message: "As senhas não conferem",
  });

export type AccountState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | null;

export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const user = await requireCurrentUser();
  const parsed = parseForm(passwordSchema, formData);
  if (!parsed.ok) return parsed.state;

  const ok = await verifyPassword(parsed.data.atual, user.passwordHash);
  if (!ok) {
    return {
      fieldErrors: { atual: ["Senha atual incorreta"] },
      error: "Senha atual incorreta.",
    };
  }

  const hash = await hashPassword(parsed.data.nova);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id));
  return { success: true };
}

const ALLOWED_LOGO = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/;

export async function saveLogoAction(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  await requireAdmin();
  const logo = String(formData.get("logo") ?? "");
  if (!ALLOWED_LOGO.test(logo)) {
    return { error: "Imagem inválida. Use PNG, JPG, WEBP ou SVG." };
  }
  if (logo.length > 900_000) {
    return { error: "Imagem muito grande. Tente uma menor." };
  }
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) {
    await db
      .update(appSettings)
      .set({ logoUrl: logo })
      .where(eq(appSettings.id, row.id));
  } else {
    await db.insert(appSettings).values({ logoUrl: logo });
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeLogoAction() {
  await requireAdmin();
  const [row] = await db.select().from(appSettings).limit(1);
  if (row) {
    await db
      .update(appSettings)
      .set({ logoUrl: null })
      .where(eq(appSettings.id, row.id));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
