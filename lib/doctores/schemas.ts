import { z } from "zod"

export const doctorIdSchema = z.uuid({ error: "El identificador del doctor no es válido" })

/** Cuerpo de `POST /api/doctors`: solicitud de registro como médico (queda pendiente de aprobación). */
export const registrarDoctorSchema = z.object({
    especialidadId: z.uuid({ error: "La especialidad es requerida y debe ser válida" }),
    cedula: z
        .string({ error: "La cédula profesional es requerida" })
        .trim()
        .regex(/^[A-Za-z0-9-]{4,20}$/, {
            error: "La cédula debe tener entre 4 y 20 letras, dígitos o guiones",
        }),
    bio: z
        .string()
        .trim()
        .max(2000, { error: "La biografía es demasiado larga" })
        .transform((v) => v || null)
        .nullish(),
})

export type RegistrarDoctorEntrada = z.infer<typeof registrarDoctorSchema>

/** Query de `GET /api/doctors`: filtros opcionales del directorio público. */
export const listarDoctoresQuerySchema = z.object({
    especialidad: z.uuid({ error: "La especialidad no es válida" }).optional(),
    ciudad: z
        .string()
        .trim()
        .max(100, { error: "La ciudad es demasiado larga" })
        .transform((v) => v || undefined)
        .optional(),
})

export type ListarDoctoresQuery = z.infer<typeof listarDoctoresQuerySchema>
