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
 * - `personal`: el doctor o sus secretarios; incluye datos internos como el motivo de los bloqueos.
 * - `admin`: ve doctores sin aprobar, pero no los datos internos de su agenda.
 * - `publica`: solo doctores aprobados.
 */
export type VistaDoctor = "publica" | "personal" | "admin"

export type HechosVistaDoctor = {
    esDueno: boolean
    esSecretario: boolean
    esAdmin: boolean
}

export function vistaDeDoctor(aprobado: boolean, hechos: HechosVistaDoctor): VistaDoctor | null {
    if (hechos.esDueno || hechos.esSecretario) return "personal"
    if (hechos.esAdmin) return "admin"
    return aprobado ? "publica" : null
}
