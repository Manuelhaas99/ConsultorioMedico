// Opciones del Pool de Postgres (pura, sin I/O). Ver pool.test.ts.
//
// Pensadas para serverless: cada instancia de función tiene su propio Pool, así
// que se mantienen pocas conexiones y se liberan pronto. Con un pooler del
// proveedor (PgBouncer de Neon/Supabase) usa su URL "pooled" en DATABASE_URL.

import type { PoolConfig } from "pg"

/** Conexiones máximas por instancia si no se define DATABASE_POOL_MAX. */
export const POOL_MAX_POR_DEFECTO = 5

export type OpcionesPool = Required<
    Pick<PoolConfig, "max" | "idleTimeoutMillis" | "connectionTimeoutMillis" | "allowExitOnIdle">
>

export function opcionesPool({ max }: { max?: number } = {}): OpcionesPool {
    return {
        max: max ?? POOL_MAX_POR_DEFECTO,
        // Cierra conexiones ociosas antes de que el proveedor o la plataforma las corten.
        idleTimeoutMillis: 10_000,
        // Falla rápido si la base no responde en lugar de colgar la petición.
        connectionTimeoutMillis: 10_000,
        // No mantiene vivo el proceso solo por conexiones ociosas (scripts como db:seed).
        allowExitOnIdle: true,
    }
}

/**
 * Si el Pool se guarda en `globalThis`. Solo fuera de producción: allí cada
 * recarga en caliente vuelve a evaluar el módulo y, sin esto, abriría un Pool
 * nuevo por recarga hasta agotar las conexiones.
 */
export function reutilizarEnGlobal(nodeEnv: string | undefined): boolean {
    return nodeEnv !== "production"
}
