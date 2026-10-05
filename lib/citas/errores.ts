// Clasificación pura de errores de Postgres relevantes para citas (sin I/O).

/** Código SQLSTATE de Postgres para `exclusion_violation`. */
export const CODIGO_VIOLACION_EXCLUSION = "23P01"

/**
 * Restricción de exclusión que impide citas activas traslapadas de un mismo doctor
 * (ver lib/db/migrations/0001_exclusion_citas_traslapadas.sql).
 */
export const RESTRICCION_SIN_TRASLAPE = "cita_sin_traslape_por_doctor"

type ErrorPg = { code?: unknown; constraint?: unknown; cause?: unknown }

function esObjeto(valor: unknown): valor is ErrorPg {
    return typeof valor === "object" && valor !== null
}

/**
 * Indica si `error` (o alguna de sus causas) es la violación de la restricción
 * que impide citas traslapadas. Drizzle envuelve el error de `pg` en
 * `DrizzleQueryError`, cuya `cause` trae `code` y `constraint`.
 */
export function esTraslapeDeCitas(error: unknown): boolean {
    const vistos = new Set<unknown>()
    let actual: unknown = error
    while (esObjeto(actual) && !vistos.has(actual)) {
        vistos.add(actual)
        if (actual.code === CODIGO_VIOLACION_EXCLUSION && actual.constraint === RESTRICCION_SIN_TRASLAPE) {
            return true
        }
        actual = actual.cause
    }
    return false
}
