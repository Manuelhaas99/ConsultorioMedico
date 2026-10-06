// Usa a propósito la zona horaria del proceso, como el código original; pasar a la
// zona del consultorio es un cambio aparte.

import type { diaSemanaEnum } from "@/lib/db/schema"
import { ocupaHorario, seTraslapan, type EstadoCita, type Intervalo } from "./intervalos"

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

export type { Intervalo }

export type CitaAgendada = Intervalo & { estado: EstadoCita }

/** Franja de disponibilidad semanal, con horas "HH:MM" o "HH:MM:SS". */
export type Franja = { horaInicio: string; horaFin: string }

export type Slot = { inicio: string; fin: string; disponible: boolean }

export type ParametrosSlots = {
    /** YYYY-MM-DD */
    fecha: string
    duracionMinutos: number
    franjas: readonly Franja[]
    bloqueos: readonly Intervalo[]
    /** Las canceladas no ocupan el horario. */
    citas: readonly CitaAgendada[]
}

export function diaSemanaDeFecha(fecha: string): DiaSemana | undefined {
    return DIAS_SEMANA[new Date(fecha).getDay()]
}

export function ventanaDeFranjas(fecha: string, franjas: readonly Franja[]): Intervalo | null {
    if (franjas.length === 0) return null
    const inicios = franjas.map((f) => aHoraDelDia(fecha, f.horaInicio).getTime())
    const fines = franjas.map((f) => aHoraDelDia(fecha, f.horaFin).getTime())
    return { inicio: new Date(Math.min(...inicios)), fin: new Date(Math.max(...fines)) }
}

function aHoraDelDia(fecha: string, hora: string): Date {
    const [h, m] = hora.split(":").map(Number)
    const d = new Date(fecha)
    d.setHours(h, m, 0, 0)
    return d
}

/** Lanza `RangeError` si la duración no es un entero positivo, con la que el ciclo no avanzaría. */
export function generarSlots({ fecha, duracionMinutos, franjas, bloqueos, citas }: ParametrosSlots): Slot[] {
    if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0) {
        throw new RangeError(`Duración de slot inválida: ${duracionMinutos}`)
    }
    const duracionMs = duracionMinutos * 60 * 1000
    const ocupados: Intervalo[] = [...bloqueos, ...citas.filter((c) => ocupaHorario(c.estado))]
    const slots: Slot[] = []

    for (const franja of franjas) {
        let inicio = aHoraDelDia(fecha, franja.horaInicio)
        const limite = aHoraDelDia(fecha, franja.horaFin)

        while (inicio < limite && slots.length < MAX_SLOTS) {
            const fin = new Date(inicio.getTime() + duracionMs)
            if (fin > limite) break

            const slot = { inicio, fin }
            const ocupado = ocupados.some((o) => seTraslapan(slot, o))
            slots.push({ inicio: inicio.toISOString(), fin: fin.toISOString(), disponible: !ocupado })

            inicio = fin
        }
    }

    return slots
}
