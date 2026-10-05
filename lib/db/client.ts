import "server-only"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "@/lib/env"
import { opcionesPool, reutilizarEnGlobal } from "./pool"
import { configuracionConexion } from "./ssl"

export type Db = NodePgDatabase

type Conexion = { pool: Pool; db: Db }

// En desarrollo la conexión vive en globalThis para sobrevivir a las recargas en
// caliente (ver reutilizarEnGlobal); en producción basta la variable del módulo.
const almacenGlobal = globalThis as typeof globalThis & { __conexionPg?: Conexion }
let local: Conexion | undefined

function crearConexion(): Conexion {
    const variables = env("baseDatos")
    const { connectionString, ssl } = configuracionConexion(variables)
    const pool = new Pool({ connectionString, ssl, ...opcionesPool({ max: variables.DATABASE_POOL_MAX }) })
    // Sin este listener, un error en una conexión ociosa (p. ej. la base la cierra) tumba el proceso.
    pool.on("error", (error) => {
        console.error("Error en una conexión ociosa de Postgres", error)
    })
    return { pool, db: drizzle(pool) }
}

function getConexion(): Conexion {
    if (reutilizarEnGlobal(process.env.NODE_ENV)) {
        almacenGlobal.__conexionPg ??= crearConexion()
        return almacenGlobal.__conexionPg
    }
    local ??= crearConexion()
    return local
}

export function getDb(): Db {
    return getConexion().db
}

/** Pool subyacente, para cerrarlo en scripts (`await getPool().end()`). */
export function getPool(): Pool {
    return getConexion().pool
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
