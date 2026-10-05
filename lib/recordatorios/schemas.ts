import { z } from "zod"

export const TIPOS_RECORDATORIO = ["24h", "1h"] as const
export type TipoRecordatorio = (typeof TIPOS_RECORDATORIO)[number]

/**
 * Cuerpo del mensaje que QStash entrega a POST /api/reminders.
 * `fechaInicio` es el inicio de la cita cuando se programó el recordatorio: si la
 * cita se reprogramó después, ya no coincide y el recordatorio se omite.
 * No lleva el correo del paciente: el destinatario se lee de la base al enviar.
 */
export const mensajeRecordatorioSchema = z.object({
    citaId: z.uuid(),
    tipo: z.enum(TIPOS_RECORDATORIO),
    fechaInicio: z.iso.datetime({ offset: true }).transform((valor) => new Date(valor)),
})

/** Mensaje ya validado (fechas como `Date`). */
export type MensajeRecordatorio = z.output<typeof mensajeRecordatorioSchema>
/** Mensaje tal como se publica en QStash (JSON). */
export type CuerpoMensajeRecordatorio = z.input<typeof mensajeRecordatorioSchema>
