import { z } from "zod"

export const TIPOS_RECORDATORIO = ["24h", "1h"] as const
export type TipoRecordatorio = (typeof TIPOS_RECORDATORIO)[number]

/**
 * `fechaInicio` es el horario al programar: si la cita se reprogramó ya no coincide
 * y el recordatorio se omite. Sin correo: el destinatario se lee de la base al enviar.
 */
export const mensajeRecordatorioSchema = z.object({
    citaId: z.uuid(),
    tipo: z.enum(TIPOS_RECORDATORIO),
    fechaInicio: z.iso.datetime({ offset: true }).transform((valor) => new Date(valor)),
})

export type MensajeRecordatorio = z.output<typeof mensajeRecordatorioSchema>
export type CuerpoMensajeRecordatorio = z.input<typeof mensajeRecordatorioSchema>
