import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./", import.meta.url)),
            // `server-only` lanza un error fuera de React Server Components;
            // en pruebas lo sustituimos por un módulo vacío.
            "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        include: ["**/*.test.ts"],
        exclude: ["node_modules/**", ".next/**"],
        passWithNoTests: true,
    },
})
