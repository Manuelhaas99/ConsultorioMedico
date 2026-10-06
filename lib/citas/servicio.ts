import "server-only"
import { esTraslapeDeCitas } from "./errores"
import {
    bloqueosQueTraslapan,
    citasQueTraslapan,
    franjasDelDia,
    insertarCita,
    type CitaRegistrada,
    type NuevaCita,
} from "./repositorio"
import { chocaConCitas, type Intervalo } from "./intervalos"
import type { SlotsQuery } from "./schemas"
import { diaSemanaDeFecha, generarSlots, ventanaDeFranjas, type Slot } from "./slots"
import { ZONA_CONSULTORIO } from "./zona-horaria"

export async function obtenerSlots(
    doctorId: string,
    { fecha, duracion }: SlotsQuery,
    zona: string = ZONA_CONSULTORIO,
): Promise<Slot[]> {
    const diaSemana = diaSemanaDeFecha(fecha)
    if (!diaSemana) return []

    const franjas = await franjasDelDia(doctorId, diaSemana)
    const ventana = ventanaDeFranjas(fecha, franjas, zona)
    if (!ventana) return []

    const [bloqueos, citas] = await Promise.all([
        bloqueosQueTraslapan(doctorId, ventana),
        citasQueTraslapan(doctorId, ventana),
    ])

    return generarSlots({ fecha, zona, duracionMinutos: duracion, franjas, bloqueos, citas })
}

export async function horarioLibre(doctorId: string, intervalo: Intervalo): Promise<boolean> {
    const citas = await citasQueTraslapan(doctorId, intervalo)
    return !chocaConCitas(intervalo, citas)
}

export type ResultadoReserva = { ok: true; cita: CitaRegistrada } | { ok: false; error: "HORARIO_OCUPADO" }

// La verificación previa solo responde rápido; ante reservas simultáneas la garantía
// es la restricción de exclusión, cuya violación también se reporta como HORARIO_OCUPADO.
export async function reservarCita(valores: NuevaCita): Promise<ResultadoReserva> {
    const libre = await horarioLibre(valores.doctorId, { inicio: valores.fechaInicio, fin: valores.fechaFin })
    if (!libre) return { ok: false, error: "HORARIO_OCUPADO" }

    try {
        return { ok: true, cita: await insertarCita(valores) }
    } catch (error) {
        if (esTraslapeDeCitas(error)) return { ok: false, error: "HORARIO_OCUPADO" }
        throw error
    }
}
