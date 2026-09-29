import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

const getPool = () => {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        throw new Error("DATABASE_URL is not defined")
    }
    return new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
    })
}

export const db = drizzle(getPool())