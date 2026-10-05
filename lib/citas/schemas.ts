import { z } from "zod"

/** Límites de duración de un slot, en minutos. */
export const DURACION_MIN_MINUTOS = 5
export const DURACION_MAX_MINUTOS = 240
export const DURACION_DEFAULT_MINUTOS = 30

export const doctorIdSchema = z.uuid({ error: "El identificador del doctor no es válido" })

/** Query de `GET /api/doctors/[id]/slots`. */
export const slotsQuerySchema = z.object({
    // `z.iso.date()` exige YYYY-MM-DD y una fecha de calendario real (rechaza 2026-02-30).
    fecha: z.iso.date({ error: "La fecha es requerida y debe ser una fecha válida YYYY-MM-DD" }),
    duracion: z.coerce
        .number({ error: "La duración debe ser un número de minutos" })
        .int({ error: "La duración debe ser un número entero de minutos" })
        .min(DURACION_MIN_MINUTOS, { error: `La duración mínima es ${DURACION_MIN_MINUTOS} minutos` })
        .max(DURACION_MAX_MINUTOS, { error: `La duración máxima es ${DURACION_MAX_MINUTOS} minutos` })
        .default(DURACION_DEFAULT_MINUTOS),
})

export type SlotsQuery = z.infer<typeof slotsQuerySchema>
