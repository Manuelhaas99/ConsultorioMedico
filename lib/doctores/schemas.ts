import { z } from "zod"
import { diaSemanaEnum } from "@/lib/db/schema"

export const doctorIdSchema = z.uuid({ error: "El identificador del doctor no es válido" })

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

const horaSchema = (campo: string) =>
    z
        .string({ error: `${campo} es requerida` })
        .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { error: `${campo} debe tener formato HH:MM` })
        .transform((hora) => (hora.length === 5 ? `${hora}:00` : hora))

export const crearDisponibilidadSchema = z
    .object({
        diaSemana: z.enum(diaSemanaEnum.enumValues, { error: "El día de la semana no es válido" }),
        horaInicio: horaSchema("La hora de inicio"),
        horaFin: horaSchema("La hora de fin"),
        ubicacionId: z.uuid({ error: "La ubicación no es válida" }).nullish(),
    })
    .refine((v) => v.horaFin > v.horaInicio, {
        error: "La hora de fin debe ser posterior a la de inicio",
        path: ["horaFin"],
    })

export type CrearDisponibilidadEntrada = z.infer<typeof crearDisponibilidadSchema>

// Sin zona explícita, el mismo texto significaría horas distintas según el servidor.
const instanteSchema = (campo: string) =>
    z.iso
        .datetime({ offset: true, error: `${campo} debe ser una fecha y hora ISO 8601 con zona, p. ej. 2026-10-12T09:00:00-06:00` })
        .transform((valor) => new Date(valor))

export const crearBloqueoSchema = z
    .object({
        fechaInicio: instanteSchema("La fecha de inicio"),
        fechaFin: instanteSchema("La fecha de fin"),
        motivo: z
            .string()
            .trim()
            .max(500, { error: "El motivo es demasiado largo" })
            .transform((v) => v || null)
            .nullish(),
    })
    .refine((v) => v.fechaFin > v.fechaInicio, {
        error: "La fecha de fin debe ser posterior a la de inicio",
        path: ["fechaFin"],
    })

export type CrearBloqueoEntrada = z.infer<typeof crearBloqueoSchema>
