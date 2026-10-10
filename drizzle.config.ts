import { defineConfig } from "drizzle-kit"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

// `generate` no necesita conexión; sin DATABASE_URL solo fallan `migrate` y `studio`.
const url = process.env.DATABASE_URL

export default defineConfig({
    schema: "./lib/db/schema.ts",
    out: "./lib/db/migrations",
    dialect: "postgresql",
    ...(url ? { dbCredentials: { url } } : {}),
})
