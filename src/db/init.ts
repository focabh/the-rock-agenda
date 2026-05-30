import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, bandPositions } from "./schema";
import { hashPassword } from "@/lib/auth";
import { POSICOES } from "@/lib/validators";

let initialized = false;

/**
 * Ensures database is initialized with admin user.
 * Safe to call multiple times; only initializes once per process.
 */
export async function ensureDbInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    // Check if admin exists
    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.username, "admin"))
      .limit(1);

    if (!admin) {
      // Create admin user
      const adminPassword = process.env.ADMIN_PASSWORD ?? "therock";
      const hash = await hashPassword(adminPassword);
      await db.insert(users).values({
        username: "admin",
        passwordHash: hash,
        role: "admin",
      });
      console.log("✓ Initialized database with admin user");
    }

    // Semeia as posições padrão se a tabela estiver vazia
    const [pos] = await db.select().from(bandPositions).limit(1);
    if (!pos) {
      await db.insert(bandPositions).values(
        POSICOES.map((nome, i) => ({ nome, ordem: i }))
      );
      console.log("✓ Seeded band positions");
    }
  } catch (error) {
    console.error("Error initializing database:", error);
    // Don't throw - allow graceful degradation
  }
}
