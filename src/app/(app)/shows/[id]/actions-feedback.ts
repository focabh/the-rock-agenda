"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { showSongFeedback } from "@/db/schema";
import { requireCurrentUser } from "@/lib/auth";

/** Marca/atualiza o feedback de uma música num show. Qualquer músico da banda
 *  pode editar (marcação única por show+música). */
export async function setSongFeedbackAction(
  showId: string,
  songId: string,
  patch: { publicoCurtiu: boolean; bandaCurtiu: boolean; caiu: boolean }
): Promise<{ ok: boolean }> {
  await requireCurrentUser();
  await db
    .insert(showSongFeedback)
    .values({ showId, songId, ...patch })
    .onConflictDoUpdate({
      target: [showSongFeedback.showId, showSongFeedback.songId],
      set: { ...patch, updatedAt: new Date() },
    });
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

/** Lê o feedback por música de um show (mapa songId → flags). */
export async function getShowFeedbackMap(showId: string) {
  const rows = await db
    .select()
    .from(showSongFeedback)
    .where(eq(showSongFeedback.showId, showId));
  const map: Record<string, { publicoCurtiu: boolean; bandaCurtiu: boolean; caiu: boolean }> = {};
  for (const r of rows) {
    map[r.songId] = { publicoCurtiu: r.publicoCurtiu, bandaCurtiu: r.bandaCurtiu, caiu: r.caiu };
  }
  return map;
}
