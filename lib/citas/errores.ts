export const CODIGO_VIOLACION_EXCLUSION = "23P01"

export const RESTRICCION_SIN_TRASLAPE = "cita_sin_traslape_por_doctor"

type ErrorPg = { code?: unknown; constraint?: unknown; cause?: unknown }

function esObjeto(valor: unknown): valor is ErrorPg {
    return typeof valor === "object" && valor !== null
}

// Drizzle envuelve el error de `pg` en `DrizzleQueryError`; `code` y `constraint` vienen en `cause`.
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
