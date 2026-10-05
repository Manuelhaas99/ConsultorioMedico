import "server-only"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "@/lib/env"
import { configuracionConexion } from "./ssl"

export type Db = NodePgDatabase

let instancia: Db | null = null

/**
 * Cliente de Drizzle, creado al primer uso. Valida DATABASE_URL y la
 * configuración TLS en ese momento, no al importar el módulo, para que
 * `next build` no necesite la base de datos.
 */
export function getDb(): Db {
    if (!instancia) {
        const { connectionString, ssl } = configuracionConexion(env("baseDatos"))
        instancia = drizzle(new Pool({ connectionString, ssl }))
    }
    return instancia
}

/**
 * Acceso perezoso a `getDb()` con la misma forma que el cliente de Drizzle,
 * para que los repositorios sigan usando `db.select()...`. La conexión se
 * resuelve en el primer acceso a una propiedad.
 */
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
