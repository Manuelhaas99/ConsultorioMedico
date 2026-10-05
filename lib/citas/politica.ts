// Política de acceso a una cita (pura, sin I/O). Ver politica.test.ts.
//
// Quién puede ver y modificar una cita depende de su relación con ella:
// - `paciente`: el paciente con sesión dueño de la cita o quien presenta su token de gestión.
//   Solo puede cancelar y editar el motivo de consulta de una cita futura y activa.
// - `personal`: el doctor dueño de la cita o uno de sus secretarios. Cambia el estado
//   siguiendo las transiciones válidas y escribe notas.

import type { EstadoCita } from "./intervalos"

export type RolEnCita = "paciente" | "personal"

/** Datos de la cita que necesita la política. */
export type CitaParaPolitica = {
    pacienteId: string | null
    estado: EstadoCita
    fechaInicio: Date
}

/** Hechos sobre quien hace la petición, ya verificados por el servicio. */
export type HechosDeAcceso = {
    /** Usuario con sesión, o `null`. */
    usuarioId: string | null
    /** El usuario es el doctor dueño de la cita o uno de sus secretarios. */
    esPersonal: boolean
    /** Se presentó el token de gestión correcto de la cita. */
    tokenValido: boolean
}

/** Relación de quien pide con la cita, o `null` si no tiene ninguna. El personal tiene prioridad. */
export function rolEnCita(cita: CitaParaPolitica, hechos: HechosDeAcceso): RolEnCita | null {
    if (hechos.esPersonal) return "personal"
    if (hechos.usuarioId !== null && cita.pacienteId === hechos.usuarioId) return "paciente"
    if (hechos.tokenValido) return "paciente"
    return null
}

export function puedeVer(rol: RolEnCita | null): rol is RolEnCita {
    return rol !== null
}

/**
 * Transiciones de estado que puede hacer el personal. Los estados `cancelada`,
 * `completada` y `no_show` son finales.
 */
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

/** Estados en los que el paciente todavía puede cancelar o editar su cita. */
export const ESTADOS_EDITABLES_POR_PACIENTE = ["pendiente", "confirmada"] as const satisfies readonly EstadoCita[]

/** Cambios solicitados sobre una cita (ya validados con zod). */
export type CambiosCita = {
    estado?: EstadoCita
    motivoConsulta?: string | null
    notas?: string | null
}

export type ErrorEdicion =
    /** No tiene relación con la cita. */
    | "NO_AUTORIZADO"
    /** Pide algo que su rol no permite (p. ej. el paciente confirma o escribe notas). */
    | "CAMBIO_NO_PERMITIDO"
    /** La cita ya no admite cambios del paciente (pasada, cancelada, completada...). */
    | "CITA_NO_EDITABLE"
    /** El estado pedido no es alcanzable desde el actual. */
    | "TRANSICION_INVALIDA"

/**
 * Decide si `rol` puede aplicar `cambios` a `cita` en el instante `ahora`.
 * Devuelve `null` si está permitido o el motivo del rechazo.
 */
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

    // Personal: las notas se pueden escribir en cualquier estado (p. ej. tras completar la cita),
    // pero el estado solo cambia por una transición válida.
    if (cambios.estado !== undefined && !transicionValida(cita.estado, cambios.estado)) {
        return "TRANSICION_INVALIDA"
    }
    return null
}
