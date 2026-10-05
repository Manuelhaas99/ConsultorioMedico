// Cálculo puro de slots de agenda (sin I/O). Ver pruebas en slots.test.ts.
//
// La disponibilidad semanal está en hora local del consultorio; `fecha` es un día
// de calendario en esa zona. Los slots se devuelven como instantes ISO (UTC).

import { chocaConCitas, seTraslapan, type EstadoCita, type Intervalo } from "./intervalos"
import { aInstante, diaSemanaDeFecha, type DiaSemana } from "./zona-horaria"

export { diaSemanaDeFecha, type DiaSemana }

/**
 * Tope de seguridad de slots generados por llamada. Con la duración mínima (5 min)
 * un día completo produce 288 slots; el tope evita que un dato inesperado
 * (franjas repetidas, duración mal validada) haga crecer el ciclo sin control.
 */
export const MAX_SLOTS = 1000

export type { Intervalo }

/** Cita existente tal como la necesita el cálculo de slots. */
export type CitaAgendada = Intervalo & { estado: EstadoCita }

/** Franja de disponibilidad semanal, con horas "HH:MM" o "HH:MM:SS". */
export type Franja = { horaInicio: string; horaFin: string }

export type Slot = { inicio: string; fin: string; disponible: boolean }

export type ParametrosSlots = {
    /** Fecha YYYY-MM-DD ya validada, en el calendario del consultorio. */
    fecha: string
    /** Zona IANA del consultorio, p. ej. `America/Mexico_City`. */
    zona: string
    /** Duración de cada slot en minutos (entero positivo). */
    duracionMinutos: number
    franjas: readonly Franja[]
    /** Bloqueos de horario del doctor (vacaciones, comida...). */
    bloqueos: readonly Intervalo[]
    /** Citas del doctor; las canceladas no ocupan el horario. */
    citas: readonly CitaAgendada[]
}

/**
 * Intervalo que cubren las franjas en `fecha`, o `null` si no hay franjas.
 * Sirve para consultar solo los bloqueos y citas que pueden afectar los slots.
 */
export function ventanaDeFranjas(fecha: string, franjas: readonly Franja[], zona: string): Intervalo | null {
    if (franjas.length === 0) return null
    const inicios = franjas.map((f) => aInstante(fecha, f.horaInicio, zona).getTime())
    const fines = franjas.map((f) => aInstante(fecha, f.horaFin, zona).getTime())
    return { inicio: new Date(Math.min(...inicios)), fin: new Date(Math.max(...fines)) }
}

/**
 * Genera los slots consecutivos de `duracionMinutos` dentro de cada franja,
 * interpretando sus horas en `zona`. Los slots avanzan en tiempo real: en un día
 * con cambio de horario una franja de 01:00 a 04:00 dura 2 o 4 horas, no 3.
 * Un slot no está disponible si traslapa (intervalos semiabiertos) un bloqueo o
 * una cita que ocupa horario, aunque la cita empiece antes o termine después del slot.
 * Lanza `RangeError` si la duración no es un entero positivo: con 0, negativos o
 * fracciones de milisegundo el ciclo no avanzaría.
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
