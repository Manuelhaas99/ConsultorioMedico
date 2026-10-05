import type { estadoCitaEnum } from "@/lib/db/schema"

export type EstadoCita = (typeof estadoCitaEnum.enumValues)[number]

/** Intervalo semiabierto [inicio, fin). */
export type Intervalo = { inicio: Date; fin: Date }

/** Los intervalos contiguos no se traslapan. */
export function seTraslapan(a: Intervalo, b: Intervalo): boolean {
    return a.inicio < b.fin && b.inicio < a.fin
}

/** `no_show` sigue ocupando: el doctor reservó ese tiempo aunque el paciente no llegó. */
export const ESTADOS_QUE_LIBERAN_HORARIO = ["cancelada"] as const satisfies readonly EstadoCita[]

export function ocupaHorario(estado: EstadoCita): boolean {
    return !(ESTADOS_QUE_LIBERAN_HORARIO as readonly EstadoCita[]).includes(estado)
}

/**
 * Indica si `intervalo` choca con alguna cita que ocupa horario.
 * Ignora canceladas y usa intervalos semiabiertos: 09:00–09:30 y 09:30–10:00 no chocan.
 */
export function chocaConCitas(
    intervalo: Intervalo,
    citas: readonly (Intervalo & { estado: EstadoCita })[],
): boolean {
    return citas.some((c) => ocupaHorario(c.estado) && seTraslapan(intervalo, c))
}
