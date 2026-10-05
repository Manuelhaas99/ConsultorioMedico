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
