import type { EstadoCita } from "./intervalos"

export type RolEnCita = "paciente" | "personal"

export type CitaParaPolitica = {
    pacienteId: string | null
    estado: EstadoCita
    fechaInicio: Date
}

export type HechosDeAcceso = {
    usuarioId: string | null
    /** Doctor dueño de la cita o uno de sus secretarios. */
    esPersonal: boolean
    tokenValido: boolean
}

/** El personal tiene prioridad sobre el paciente. */
export function rolEnCita(cita: CitaParaPolitica, hechos: HechosDeAcceso): RolEnCita | null {
    if (hechos.esPersonal) return "personal"
    if (hechos.usuarioId !== null && cita.pacienteId === hechos.usuarioId) return "paciente"
    if (hechos.tokenValido) return "paciente"
    return null
}

export function puedeVer(rol: RolEnCita | null): rol is RolEnCita {
    return rol !== null
}

export const TRANSICIONES_PERSONAL = {
    pendiente: ["confirmada", "cancelada"],
    confirmada: ["completada", "no_show", "cancelada"],
    cancelada: [],
    completada: [],
    no_show: [],
} as const satisfies Record<EstadoCita, readonly EstadoCita[]>

export function transicionValida(desde: EstadoCita, hacia: EstadoCita): boolean {
    return (TRANSICIONES_PERSONAL[desde] as readonly EstadoCita[]).includes(hacia)
}

export const ESTADOS_EDITABLES_POR_PACIENTE = ["pendiente", "confirmada"] as const satisfies readonly EstadoCita[]

export type CambiosCita = {
    estado?: EstadoCita
    motivoConsulta?: string | null
    notas?: string | null
}

export type ErrorEdicion =
    | "NO_AUTORIZADO"
    | "CAMBIO_NO_PERMITIDO"
    | "CITA_NO_EDITABLE"
    | "TRANSICION_INVALIDA"

/** Devuelve `null` si está permitido o el motivo del rechazo. */
export function puedeEditar(
    rol: RolEnCita | null,
    cita: CitaParaPolitica,
    cambios: CambiosCita,
    ahora: Date,
): ErrorEdicion | null {
    if (rol === null) return "NO_AUTORIZADO"

    if (rol === "paciente") {
        if (cambios.notas !== undefined) return "CAMBIO_NO_PERMITIDO"
        if (cambios.estado !== undefined && cambios.estado !== "cancelada") return "CAMBIO_NO_PERMITIDO"
        const activa = (ESTADOS_EDITABLES_POR_PACIENTE as readonly EstadoCita[]).includes(cita.estado)
        if (!activa || !(cita.fechaInicio > ahora)) return "CITA_NO_EDITABLE"
        return null
    }

    // Las notas del personal se admiten en cualquier estado, incluso tras completar la cita.
    if (cambios.estado !== undefined && !transicionValida(cita.estado, cambios.estado)) {
        return "TRANSICION_INVALIDA"
    }
    return null
}
