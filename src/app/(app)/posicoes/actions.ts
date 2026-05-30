"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, lt, desc, sql, ne } from "drizzle-orm";
import { db } from "@/db";
import { bandPositions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export type PositionResult = { ok: boolean; error?: string };

export async function createPositionAction(
  nome: string
): Promise<PositionResult> {
  await requireAdmin();
  const n = nome.trim();
  if (!n) return { ok: false, error: "Escreva o nome da posição." };
  if (n.length > 60) return { ok: false, error: "Nome muito longo." };

  const dup = await db
    .select({ id: bandPositions.id })
    .from(bandPositions)
    .where(sql`lower(${bandPositions.nome}) = ${n.toLowerCase()}`)
    .limit(1);
  if (dup.length) return { ok: false, error: "Essa posição já existe." };

  const last = await db
    .select({ max: sql<number>`coalesce(max(${bandPositions.ordem}), -1)` })
    .from(bandPositions);
  const ordem = (last[0]?.max ?? -1) + 1;

  await db.insert(bandPositions).values({ nome: n, ordem });
  revalidatePath("/posicoes");
  return { ok: true };
}

export async function renamePositionAction(
  id: string,
  nome: string
): Promise<PositionResult> {
  await requireAdmin();
  const n = nome.trim();
  if (!n) return { ok: false, error: "Nome vazio." };

  const dup = await db
    .select({ id: bandPositions.id })
    .from(bandPositions)
    .where(
      and(
        sql`lower(${bandPositions.nome}) = ${n.toLowerCase()}`,
        ne(bandPositions.id, id)
      )
    )
    .limit(1);
  if (dup.length) return { ok: false, error: "Já existe uma posição com esse nome." };

  await db.update(bandPositions).set({ nome: n }).where(eq(bandPositions.id, id));
  revalidatePath("/posicoes");
  return { ok: true };
}

export async function togglePositionAction(
  id: string,
  ativo: boolean
): Promise<PositionResult> {
  await requireAdmin();
  await db.update(bandPositions).set({ ativo }).where(eq(bandPositions.id, id));
  revalidatePath("/posicoes");
  return { ok: true };
}

export async function deletePositionAction(
  id: string
): Promise<PositionResult> {
  await requireAdmin();
  await db.delete(bandPositions).where(eq(bandPositions.id, id));
  revalidatePath("/posicoes");
  return { ok: true };
}

export async function movePositionAction(
  id: string,
  direction: "up" | "down"
): Promise<PositionResult> {
  await requireAdmin();
  const [item] = await db
    .select()
    .from(bandPositions)
    .where(eq(bandPositions.id, id))
    .limit(1);
  if (!item) return { ok: false, error: "Posição não encontrada." };

  const [neighbor] = await db
    .select()
    .from(bandPositions)
    .where(
      direction === "up"
        ? lt(bandPositions.ordem, item.ordem)
        : gt(bandPositions.ordem, item.ordem)
    )
    .orderBy(
      direction === "up"
        ? desc(bandPositions.ordem)
        : asc(bandPositions.ordem)
    )
    .limit(1);
  if (!neighbor) return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(bandPositions)
      .set({ ordem: item.ordem })
      .where(eq(bandPositions.id, neighbor.id));
    await tx
      .update(bandPositions)
      .set({ ordem: neighbor.ordem })
      .where(eq(bandPositions.id, item.id));
  });
  revalidatePath("/posicoes");
  return { ok: true };
}
