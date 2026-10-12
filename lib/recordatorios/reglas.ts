import type { EstadoCita } from "@/lib/citas/intervalos"
import type { CuerpoMensajeRecordatorio, MensajeRecordatorio, TipoRecordatorio } from "./schemas"

export const ANTICIPACION_MS: Record<TipoRecordatorio, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "1h": 60 * 60 * 1000,
}

export const ESTADOS_CON_RECORDATORIO = ["pendiente", "confirmada"] as const satisfies readonly EstadoCita[]

export type RecordatorioProgramado = { tipo: TipoRecordatorio; enviarEn: Date; cuerpo: CuerpoMensajeRecordatorio }

export function recordatoriosPorProgramar(
    citaId: string,
    fechaInicio: Date,
    ahora: Date = new Date(),
): RecordatorioProgramado[] {
    return (Object.keys(ANTICIPACION_MS) as TipoRecordatorio[]).flatMap((tipo) => {
        const enviarEn = new Date(fechaInicio.getTime() - ANTICIPACION_MS[tipo])
        if (enviarEn <= ahora) return []
        return [{ tipo, enviarEn, cuerpo: { citaId, tipo, fechaInicio: fechaInicio.toISOString() } }]
    })
}

/**
 * Clave de deduplicación en QStash y de idempotencia en Resend. Incluye el horario
 * para que reprogramar la cita sí genere un recordatorio nuevo.
 */
export function claveRecordatorio({ citaId, tipo, fechaInicio }: Pick<MensajeRecordatorio, "citaId" | "tipo" | "fechaInicio">): string {
    return `recordatorio-${citaId}-${tipo}-${fechaInicio.getTime()}`
}

export type EstadoRecordatorioCita = {
    estado: EstadoCita
    fechaInicio: Date
    recordatorio24hEnviado: boolean
    recordatorio1hEnviado: boolean
    emailDestinatario: string | null
}

export type MotivoOmision = "CITA_INACTIVA" | "HORARIO_CAMBIADO" | "YA_ENVIADO" | "SIN_DESTINATARIO"

export function yaEnviado(cita: EstadoRecordatorioCita, tipo: TipoRecordatorio): boolean {
    return tipo === "24h" ? cita.recordatorio24hEnviado : cita.recordatorio1hEnviado
}

export function motivoParaOmitir(cita: EstadoRecordatorioCita, mensaje: MensajeRecordatorio): MotivoOmision | null {
    if (!(ESTADOS_CON_RECORDATORIO as readonly EstadoCita[]).includes(cita.estado)) return "CITA_INACTIVA"
    if (cita.fechaInicio.getTime() !== mensaje.fechaInicio.getTime()) return "HORARIO_CAMBIADO"
    if (yaEnviado(cita, mensaje.tipo)) return "YA_ENVIADO"
    if (!cita.emailDestinatario) return "SIN_DESTINATARIO"
    return null
}
