import "server-only"
import { bloqueosQueTraslapan, citasQueTraslapan, franjasDelDia } from "./repositorio"
import { chocaConCitas, type Intervalo } from "./intervalos"
import type { SlotsQuery } from "./schemas"
import { diaSemanaDeFecha, generarSlots, ventanaDeFranjas, type Slot } from "./slots"

/** Slots del doctor en una fecha, marcando como no disponibles los bloqueados u ocupados. */
export async function obtenerSlots(doctorId: string, { fecha, duracion }: SlotsQuery): Promise<Slot[]> {
    const diaSemana = diaSemanaDeFecha(fecha)
    if (!diaSemana) return []

    const franjas = await franjasDelDia(doctorId, diaSemana)
    const ventana = ventanaDeFranjas(fecha, franjas)
    if (!ventana) return []

    const [bloqueos, citas] = await Promise.all([
        bloqueosQueTraslapan(doctorId, ventana),
        citasQueTraslapan(doctorId, ventana),
    ])

    return generarSlots({ fecha, duracionMinutos: duracion, franjas, bloqueos, citas })
}

/** Indica si el doctor tiene libre `intervalo`, es decir, sin citas activas que lo traslapen. */
export async function horarioLibre(doctorId: string, intervalo: Intervalo): Promise<boolean> {
    const citas = await citasQueTraslapan(doctorId, intervalo)
    return !chocaConCitas(intervalo, citas)
}
