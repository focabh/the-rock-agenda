import type { Config } from "drizzle-kit";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: tursoUrl ? "turso" : "sqlite",
  dbCredentials: tursoUrl
    ? { url: tursoUrl, authToken: tursoToken }
    : { url: process.env.DATABASE_URL ?? "./data/therock.db" },
  verbose: true,
  strict: true,
} satisfies Config;
