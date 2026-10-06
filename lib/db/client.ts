import "server-only"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "@/lib/env"
import { configuracionConexion } from "./ssl"

export type Db = NodePgDatabase

let instancia: Db | null = null

export function getDb(): Db {
    if (!instancia) {
        const { connectionString, ssl } = configuracionConexion(env("baseDatos"))
        instancia = drizzle(new Pool({ connectionString, ssl }))
    }
    return instancia
}

/** Conecta en el primer acceso a una propiedad, para que importar `db` no requiera la base de datos. */
export const db: Db = new Proxy({} as Db, {
    get(_objetivo, propiedad) {
        const real = getDb()
        const valor: unknown = Reflect.get(real, propiedad, real)
        return typeof valor === "function" ? valor.bind(real) : valor
    },
    has(_objetivo, propiedad) {
        return Reflect.has(getDb(), propiedad)
    },
})
