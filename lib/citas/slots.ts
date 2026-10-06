
import { chocaConCitas, seTraslapan, type EstadoCita, type Intervalo } from "./intervalos"
import { aInstante, diaSemanaDeFecha, type DiaSemana } from "./zona-horaria"

export { diaSemanaDeFecha, type DiaSemana }

// Un día completo con la duración mínima da 288 slots; el tope protege de datos
// inesperados como franjas repetidas.
export const MAX_SLOTS = 1000

export type { Intervalo }

export type CitaAgendada = Intervalo & { estado: EstadoCita }

/** Franja de disponibilidad semanal, con horas "HH:MM" o "HH:MM:SS". */
export type Franja = { horaInicio: string; horaFin: string }

export type Slot = { inicio: string; fin: string; disponible: boolean }

export type ParametrosSlots = {
    /** YYYY-MM-DD en el calendario del consultorio. */
    fecha: string
    /** Zona IANA del consultorio. */
    zona: string
    duracionMinutos: number
    franjas: readonly Franja[]
    bloqueos: readonly Intervalo[]
    /** Las canceladas no ocupan el horario. */
    citas: readonly CitaAgendada[]
}

export function ventanaDeFranjas(fecha: string, franjas: readonly Franja[], zona: string): Intervalo | null {
    if (franjas.length === 0) return null
    const inicios = franjas.map((f) => aInstante(fecha, f.horaInicio, zona).getTime())
    const fines = franjas.map((f) => aInstante(fecha, f.horaFin, zona).getTime())
    return { inicio: new Date(Math.min(...inicios)), fin: new Date(Math.max(...fines)) }
}

/**
 * Los slots avanzan en tiempo real: en un día con cambio de horario una franja de
 * 01:00 a 04:00 dura 2 o 4 horas, no 3. Lanza `RangeError` si la duración no es un
 * entero positivo, con la que el ciclo no avanzaría.
 */
export function generarSlots({ fecha, zona, duracionMinutos, franjas, bloqueos, citas }: ParametrosSlots): Slot[] {
    if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0) {
        throw new RangeError(`Duración de slot inválida: ${duracionMinutos}`)
    }
    const duracionMs = duracionMinutos * 60 * 1000
    const slots: Slot[] = []

    for (const franja of franjas) {
        let inicio = aInstante(fecha, franja.horaInicio, zona)
        const limite = aInstante(fecha, franja.horaFin, zona)

        while (inicio < limite && slots.length < MAX_SLOTS) {
            const fin = new Date(inicio.getTime() + duracionMs)
            if (fin > limite) break

            const slot = { inicio, fin }
            const ocupado = bloqueos.some((b) => seTraslapan(slot, b)) || chocaConCitas(slot, citas)
            slots.push({ inicio: inicio.toISOString(), fin: fin.toISOString(), disponible: !ocupado })

            inicio = fin
        }
    }

    return slots
}
