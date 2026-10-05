import { defineConfig } from "drizzle-kit"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

// `generate` no necesita conexión; `migrate` y `studio` fallan con un mensaje
// claro de drizzle-kit si falta DATABASE_URL.
const url = process.env.DATABASE_URL

export default defineConfig({
    schema: "./lib/db/schema.ts",
    out: "./lib/db/migrations",
    dialect: "postgresql",
    ...(url ? { dbCredentials: { url } } : {}),
})
