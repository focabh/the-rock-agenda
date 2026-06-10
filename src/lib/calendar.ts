import "server-only";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Lê (ou cria) o token secreto do feed .ics da banda. Idempotente — usa a
 *  linha singleton de app_settings. */
export async function getOrCreateCalendarToken(): Promise<string> {
  const [s] = await db.select().from(appSettings).limit(1);
  if (s?.calendarToken) return s.calendarToken;
  const token = crypto.randomUUID().replace(/-/g, "");
  if (s) {
    await db.update(appSettings).set({ calendarToken: token }).where(eq(appSettings.id, s.id));
  } else {
    await db.insert(appSettings).values({ calendarToken: token });
  }
  return token;
}
