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

// Sin zona explícita, el mismo texto significaría horas distintas según el servidor.
const instanteSchema = (campo: string) =>
    z.iso
        .datetime({ offset: true, error: `${campo} debe ser una fecha y hora ISO 8601 con zona, p. ej. 2026-10-12T09:00:00-06:00` })
        .transform((valor) => new Date(valor))

/** Trata "" como ausente. */
const textoOpcional = (max: number, mensaje: string) =>
    z
        .string()
        .trim()
        .max(max, { error: mensaje })
        .transform((v) => v || undefined)
        .optional()

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

export const citaIdSchema = z.uuid({ error: "El identificador de la cita no es válido" })

/** Estados posibles de una cita (los mismos valores que el enum `estado_cita` de la base). */
export const ESTADOS_CITA = ["pendiente", "confirmada", "cancelada", "completada", "no_show"] as const

/** Texto editable: recorta espacios; "" o `null` lo borran (se guarda `null`). */
const textoEditable = (max: number, mensaje: string) =>
    z
        .string()
        .trim()
        .max(max, { error: mensaje })
        .nullable()
        .transform((v) => v || null)
        .optional()

/**
 * Cuerpo de `PATCH /api/appointments/[id]`. Qué campos puede cambiar cada quien lo
 * decide la política (`politica.ts`); aquí solo se valida forma y tamaño.
 */
export const actualizarCitaSchema = z
    .strictObject(
        {
            estado: z.enum(ESTADOS_CITA, { error: `El estado debe ser uno de: ${ESTADOS_CITA.join(", ")}` }).optional(),
            motivoConsulta: textoEditable(1000, "El motivo de consulta es demasiado largo"),
            notas: textoEditable(5000, "Las notas son demasiado largas"),
        },
        { error: "Campo no permitido" },
    )
    .refine((c) => c.estado !== undefined || c.motivoConsulta !== undefined || c.notas !== undefined, {
        error: "Indica al menos un campo a modificar: estado, motivoConsulta o notas",
    })

export type ActualizarCitaEntrada = z.output<typeof actualizarCitaSchema>
