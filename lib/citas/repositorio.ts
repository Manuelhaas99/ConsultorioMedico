import "server-only"
import { and, eq, gt, lt, notInArray } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { bloqueoHorario, cita, disponibilidadDoctor } from "@/lib/db/schema"
import { ESTADOS_QUE_LIBERAN_HORARIO, type Intervalo } from "./intervalos"
import type { CitaAgendada, DiaSemana, Franja } from "./slots"

export async function franjasDelDia(doctorId: string, diaSemana: DiaSemana): Promise<Franja[]> {
    return db
        .select({ horaInicio: disponibilidadDoctor.horaInicio, horaFin: disponibilidadDoctor.horaFin })
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
