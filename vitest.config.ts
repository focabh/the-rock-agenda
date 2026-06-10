import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // os testes offline mexem em estado global de módulo (registry/queue) —
    // isolar por arquivo evita vazamento entre suites
    isolate: true,
  },
});
