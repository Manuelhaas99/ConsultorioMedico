import { z } from "zod"

export const DURACION_MIN_MINUTOS = 5
export const DURACION_MAX_MINUTOS = 240
export const DURACION_DEFAULT_MINUTOS = 30

export const doctorIdSchema = z.uuid({ error: "El identificador del doctor no es válido" })

export const slotsQuerySchema = z.object({
    fecha: z.iso.date({ error: "La fecha es requerida y debe ser una fecha válida YYYY-MM-DD" }),
    duracion: z.coerce
        .number({ error: "La duración debe ser un número de minutos" })
        .int({ error: "La duración debe ser un número entero de minutos" })
        .min(DURACION_MIN_MINUTOS, { error: `La duración mínima es ${DURACION_MIN_MINUTOS} minutos` })
        .max(DURACION_MAX_MINUTOS, { error: `La duración máxima es ${DURACION_MAX_MINUTOS} minutos` })
        .default(DURACION_DEFAULT_MINUTOS),
})

export type SlotsQuery = z.infer<typeof slotsQuerySchema>

/**
 * Instante ISO 8601 con zona explícita (`Z` o `±HH:MM`). Sin zona, el mismo texto
 * significaría horas distintas según el servidor, así que se rechaza.
 */
const instanteSchema = (campo: string) =>
    z.iso
        .datetime({ offset: true, error: `${campo} debe ser una fecha y hora ISO 8601 con zona, p. ej. 2026-10-12T09:00:00-06:00` })
        .transform((valor) => new Date(valor))

/** Texto opcional: recorta espacios y trata "" como ausente. */
const textoOpcional = (max: number, mensaje: string) =>
    z
        .string()
        .trim()
        .max(max, { error: mensaje })
        .transform((v) => v || undefined)
        .optional()

/** Cuerpo de `POST /api/appointments`. Las reglas que requieren datos (disponibilidad, bloqueos...) viven en el servicio. */
export const crearCitaSchema = z
    .object({
        doctorId: doctorIdSchema,
        fechaInicio: instanteSchema("La fecha de inicio"),
        fechaFin: instanteSchema("La fecha de fin"),
        ubicacionId: z.uuid({ error: "La ubicación no es válida" }).nullish(),
        tipoConsultaId: z.uuid({ error: "El tipo de consulta no es válido" }).nullish(),
        motivoConsulta: textoOpcional(1000, "El motivo de consulta es demasiado largo"),
        invitadoNombre: textoOpcional(120, "El nombre es demasiado largo"),
        invitadoEmail: z
            .email({ error: "El correo no es válido" })
            .max(254, { error: "El correo es demasiado largo" })
            .optional(),
        invitadoTelefono: textoOpcional(30, "El teléfono es demasiado largo"),
    })
    .refine((c) => c.fechaFin > c.fechaInicio, {
        error: "La fecha de fin debe ser posterior a la de inicio",
        path: ["fechaFin"],
    })

export type CrearCitaEntrada = z.output<typeof crearCitaSchema>
