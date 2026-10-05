import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { configuracionConexion } from "./ssl"

const getPool = () => {
    const { connectionString, ssl } = configuracionConexion({
        DATABASE_URL: process.env.DATABASE_URL,
        DATABASE_SSL: process.env.DATABASE_SSL,
        DATABASE_CA_CERT: process.env.DATABASE_CA_CERT,
    })
    return new Pool({ connectionString, ssl })
}

export const db = drizzle(getPool())
