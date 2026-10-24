import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mesmo apelido "@/" do tsconfig, para os testes de rota importarem os módulos como o app importa.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
