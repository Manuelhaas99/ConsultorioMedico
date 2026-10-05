// Reglas puras de registro y aprobación de doctores (sin I/O). Ver politica.test.ts.

import type { Rol } from "@/lib/auth/roles"

/**
 * Solo un paciente puede solicitar ser médico: el personal (secretario, admin)
 * conserva su rol y un médico ya tiene perfil.
 */
export function puedeSolicitarRegistro(rol: Rol | null): boolean {
    return rol === "paciente"
}

/** Solo un administrador aprueba doctores. */
export function puedeAprobarDoctores(rol: Rol | null): boolean {
    return rol === "admin"
}

/**
 * Rol del usuario una vez aprobado su perfil de doctor. Un paciente pasa a
 * `medico`; cualquier otro rol (p. ej. un admin que también atiende) se
 * conserva para no quitarle permisos.
 */
export function rolTrasAprobacion(rolActual: Rol): Rol {
    return rolActual === "paciente" ? "medico" : rolActual
}
