import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/auth";

/**
 * Seed idempotente — só garante que existe um admin.
 * NÃO toca em casas, membros, repertório, shows ou outros dados reais.
 * Seguro de rodar a qualquer momento.
 */
async function main() {
  const adminUsername = "admin";
  const adminPass = process.env.ADMIN_PASSWORD ?? "therock";

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, adminUsername))
    .limit(1);

  if (existing.length > 0) {
    console.log(`✓ Admin "${adminUsername}" já existe — nada a fazer.`);
    return;
  }

  const hash = await hashPassword(adminPass);
  await db.insert(users).values({
    username: adminUsername,
    passwordHash: hash,
    role: "admin",
  });
  console.log(`✓ Admin "${adminUsername}" criado (senha: ${adminPass}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
