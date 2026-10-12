export const CODIGO_VIOLACION_UNICA = "23505"
export const CODIGO_VIOLACION_LLAVE_FORANEA = "23503"

export const RESTRICCION_USUARIO_UNICO = "doctor_usuario_id_unique"
export const RESTRICCION_CEDULA_UNICA = "doctor_cedula_unique"
export const RESTRICCION_ESPECIALIDAD = "doctor_especialidad_id_especialidad_id_fk"

export type ConflictoDoctor = "PERFIL_DUPLICADO" | "CEDULA_DUPLICADA" | "ESPECIALIDAD_INVALIDA"

type ErrorPg = { code?: unknown; constraint?: unknown; cause?: unknown }

function esObjeto(valor: unknown): valor is ErrorPg {
    return typeof valor === "object" && valor !== null
}

/** Drizzle envuelve el error de `pg` en `cause`, así que se recorre la cadena. */
export function conflictoDeDoctor(error: unknown): ConflictoDoctor | null {
    const vistos = new Set<unknown>()
    let actual: unknown = error
    while (esObjeto(actual) && !vistos.has(actual)) {
        vistos.add(actual)
        if (actual.code === CODIGO_VIOLACION_UNICA) {
            if (actual.constraint === RESTRICCION_USUARIO_UNICO) return "PERFIL_DUPLICADO"
            if (actual.constraint === RESTRICCION_CEDULA_UNICA) return "CEDULA_DUPLICADA"
        }
        if (actual.code === CODIGO_VIOLACION_LLAVE_FORANEA && actual.constraint === RESTRICCION_ESPECIALIDAD) {
            return "ESPECIALIDAD_INVALIDA"
        }
        actual = actual.cause
    }
    return null
}
