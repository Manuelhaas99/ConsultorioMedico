// Cálculo puro de slots de agenda (sin I/O). Ver pruebas en slots.test.ts.
//
// Nota: por ahora conserva el manejo horario histórico (`new Date(fecha)` + `setHours`
// en la zona del proceso). La corrección de zona horaria se hace por separado (C6).

import type { diaSemanaEnum } from "@/lib/db/schema"

export type DiaSemana = (typeof diaSemanaEnum.enumValues)[number]

/** Índices de `Date#getDay` (0 = domingo) a nombre de día del esquema. */
const DIAS_SEMANA = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
] as const satisfies readonly DiaSemana[]

/**
 * Tope de seguridad de slots generados por llamada. Con la duración mínima (5 min)
 * un día completo produce 288 slots; el tope evita que un dato inesperado
 * (franjas repetidas, duración mal validada) haga crecer el ciclo sin control.
 */
export const MAX_SLOTS = 1000

export type Intervalo = { inicio: Date; fin: Date }

/** Franja de disponibilidad semanal, con horas "HH:MM" o "HH:MM:SS". */
export type Franja = { horaInicio: string; horaFin: string }

export type Slot = { inicio: string; fin: string; disponible: boolean }

export type ParametrosSlots = {
    /** Fecha YYYY-MM-DD ya validada. */
    fecha: string
    /** Duración de cada slot en minutos (entero positivo). */
    duracionMinutos: number
    franjas: readonly Franja[]
    /** Intervalos que vuelven no disponible a un slot (bloqueos, citas). */
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

/**
 * Genera los slots consecutivos de `duracionMinutos` dentro de cada franja.
 * Lanza `RangeError` si la duración no es un entero positivo: con 0, negativos o
 * fracciones de milisegundo el ciclo no avanzaría.
 */
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
