import "server-only"
import { bloqueosQueTraslapan, citasQueTraslapan, franjasDelDia } from "./repositorio"
import type { SlotsQuery } from "./schemas"
import { diaSemanaDeFecha, generarSlots, ventanaDeFranjas, type Slot } from "./slots"

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
