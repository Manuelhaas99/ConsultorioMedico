import type { Rol } from "@/lib/auth/roles"

/** El personal (secretario, admin) conserva su rol y un médico ya tiene perfil. */
export function puedeSolicitarRegistro(rol: Rol | null): boolean {
    return rol === "paciente"
}

export function puedeAprobarDoctores(rol: Rol | null): boolean {
    return rol === "admin"
}

/** Un rol distinto de paciente (p. ej. un admin que también atiende) se conserva para no quitarle permisos. */
export function rolTrasAprobacion(rolActual: Rol): Rol {
    return rolActual === "paciente" ? "medico" : rolActual
}

/**
 * Cómo ve a un doctor quien hace la petición:
 * - `personal`: el propio doctor o uno de sus secretarios (incluye datos internos como el motivo de los bloqueos).
 * - `admin`: un administrador (ve doctores pendientes de aprobación, pero no datos internos de su agenda).
 * - `publica`: cualquiera, solo si el doctor está aprobado.
 */
export type VistaDoctor = "publica" | "personal" | "admin"

/** Hechos sobre quien pide, ya verificados por el servicio. */
export type HechosVistaDoctor = {
    esDueno: boolean
    esSecretario: boolean
    esAdmin: boolean
}

/** Vista que corresponde, o `null` si el doctor no debe ser visible (se responde 404). */
export function vistaDeDoctor(aprobado: boolean, hechos: HechosVistaDoctor): VistaDoctor | null {
    if (hechos.esDueno || hechos.esSecretario) return "personal"
    if (hechos.esAdmin) return "admin"
    return aprobado ? "publica" : null
}
