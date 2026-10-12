// En serverless cada instancia tiene su propio Pool: pocas conexiones y liberadas
// pronto. Con un pooler del proveedor (PgBouncer) usa su URL "pooled".

import type { PoolConfig } from "pg"

export const POOL_MAX_POR_DEFECTO = 5

export type OpcionesPool = Required<
    Pick<PoolConfig, "max" | "idleTimeoutMillis" | "connectionTimeoutMillis" | "allowExitOnIdle">
>

export function opcionesPool({ max }: { max?: number } = {}): OpcionesPool {
    return {
        max: max ?? POOL_MAX_POR_DEFECTO,
        // Cierra conexiones ociosas antes de que el proveedor o la plataforma las corten.
        idleTimeoutMillis: 10_000,
        // Falla rápido en lugar de colgar la petición.
        connectionTimeoutMillis: 10_000,
        // No mantiene vivo el proceso solo por conexiones ociosas (scripts como db:seed).
        allowExitOnIdle: true,
    }
}

/** Fuera de producción cada recarga en caliente reevalúa el módulo y abriría un Pool nuevo hasta agotar conexiones. */
export function reutilizarEnGlobal(nodeEnv: string | undefined): boolean {
    return nodeEnv !== "production"
}
