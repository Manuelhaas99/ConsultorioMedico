import "server-only"
import { and, eq, gt, lt, notInArray } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { bloqueoHorario, cita, disponibilidadDoctor, doctor, tipoConsulta, ubicacion, usuario } from "@/lib/db/schema"
import { ESTADOS_QUE_LIBERAN_HORARIO, type Intervalo } from "./intervalos"
import type { FranjaConUbicacion } from "./reglas"
import type { CitaAgendada, DiaSemana } from "./slots"

/** Solo doctores aprobados. */
export async function doctorReservable(doctorId: string): Promise<{ id: string; nombre: string } | undefined> {
    const [fila] = await db
        .select({ id: doctor.id, nombre: usuario.name })
        .from(doctor)
        .innerJoin(usuario, eq(doctor.usuarioId, usuario.id))
        .where(and(eq(doctor.id, doctorId), eq(doctor.aprobado, true)))
        .limit(1)
    return fila
}

export async function ubicacionDelDoctor(ubicacionId: string, doctorId: string): Promise<boolean> {
    const [fila] = await db
        .select({ id: ubicacion.id })
        .from(ubicacion)
        .where(and(eq(ubicacion.id, ubicacionId), eq(ubicacion.doctorId, doctorId)))
        .limit(1)
    return fila !== undefined
}

export async function tipoConsultaDelDoctor(
    tipoConsultaId: string,
    doctorId: string,
): Promise<{ duracionMinutos: number } | undefined> {
    const [fila] = await db
        .select({ duracionMinutos: tipoConsulta.duracionMinutos })
        .from(tipoConsulta)
        .where(and(eq(tipoConsulta.id, tipoConsultaId), eq(tipoConsulta.doctorId, doctorId)))
        .limit(1)
    return fila
}

export async function franjasDelDia(doctorId: string, diaSemana: DiaSemana): Promise<FranjaConUbicacion[]> {
    return db
        .select({
            horaInicio: disponibilidadDoctor.horaInicio,
            horaFin: disponibilidadDoctor.horaFin,
            ubicacionId: disponibilidadDoctor.ubicacionId,
        })
        .from(disponibilidadDoctor)
        .where(and(eq(disponibilidadDoctor.doctorId, doctorId), eq(disponibilidadDoctor.diaSemana, diaSemana)))
}

export async function bloqueosQueTraslapan(doctorId: string, rango: Intervalo): Promise<Intervalo[]> {
    return db
        .select({ inicio: bloqueoHorario.fechaInicio, fin: bloqueoHorario.fechaFin })
        .from(bloqueoHorario)
        .where(
            and(
                eq(bloqueoHorario.doctorId, doctorId),
                lt(bloqueoHorario.fechaInicio, rango.fin),
                gt(bloqueoHorario.fechaFin, rango.inicio),
            ),
        )
}

export async function citasQueTraslapan(doctorId: string, rango: Intervalo): Promise<CitaAgendada[]> {
    return db
        .select({ inicio: cita.fechaInicio, fin: cita.fechaFin, estado: cita.estado })
        .from(cita)
        .where(
            and(
                eq(cita.doctorId, doctorId),
                lt(cita.fechaInicio, rango.fin),
                gt(cita.fechaFin, rango.inicio),
                notInArray(cita.estado, [...ESTADOS_QUE_LIBERAN_HORARIO]),
            ),
        )
}

export type NuevaCita = typeof cita.$inferInsert
export type CitaRegistrada = typeof cita.$inferSelect

export async function insertarCita(valores: NuevaCita): Promise<CitaRegistrada> {
    const [nueva] = await db.insert(cita).values(valores).returning()
    if (!nueva) throw new Error("La inserción de la cita no devolvió filas")
    return nueva
}
