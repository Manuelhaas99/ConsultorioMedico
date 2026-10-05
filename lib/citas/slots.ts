// Usa a propósito la zona horaria del proceso, como el código original; pasar a la
// zona del consultorio es un cambio aparte.

import type { diaSemanaEnum } from "@/lib/db/schema"

export type DiaSemana = (typeof diaSemanaEnum.enumValues)[number]

const DIAS_SEMANA = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
] as const satisfies readonly DiaSemana[]

// Un día completo con la duración mínima da 288 slots; el tope protege de datos
// inesperados como franjas repetidas.
export const MAX_SLOTS = 1000

export type Intervalo = { inicio: Date; fin: Date }

/** Franja de disponibilidad semanal, con horas "HH:MM" o "HH:MM:SS". */
export type Franja = { horaInicio: string; horaFin: string }

export type Slot = { inicio: string; fin: string; disponible: boolean }

export type ParametrosSlots = {
    /** YYYY-MM-DD */
    fecha: string
    duracionMinutos: number
    franjas: readonly Franja[]
    /** Bloqueos y citas. */
    ocupados: readonly Intervalo[]
}

export function diaSemanaDeFecha(fecha: string): DiaSemana | undefined {
    return DIAS_SEMANA[new Date(fecha).getDay()]
}

function aHoraDelDia(fecha: string, hora: string): Date {
    const [h, m] = hora.split(":").map(Number)
    const d = new Date(fecha)
    d.setHours(h, m, 0, 0)
    return d
}

/** Lanza `RangeError` si la duración no es un entero positivo, con la que el ciclo no avanzaría. */
export function generarSlots({ fecha, duracionMinutos, franjas, ocupados }: ParametrosSlots): Slot[] {
    if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0) {
        throw new RangeError(`Duración de slot inválida: ${duracionMinutos}`)
    }
    const duracionMs = duracionMinutos * 60 * 1000
    const slots: Slot[] = []

    for (const franja of franjas) {
        let inicio = aHoraDelDia(fecha, franja.horaInicio)
        const limite = aHoraDelDia(fecha, franja.horaFin)

        while (inicio < limite && slots.length < MAX_SLOTS) {
            const fin = new Date(inicio.getTime() + duracionMs)
            if (fin > limite) break

            const ocupado = ocupados.some((o) => inicio < o.fin && fin > o.inicio)
            slots.push({ inicio: inicio.toISOString(), fin: fin.toISOString(), disponible: !ocupado })

            inicio = fin
        }
    }

    return slots
}
