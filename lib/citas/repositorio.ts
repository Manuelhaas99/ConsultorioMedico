import "server-only"
import { and, eq, gt, lt, notInArray, or, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { bloqueoHorario, cita, disponibilidadDoctor, doctor, especialidad, secretario, tipoConsulta, ubicacion, usuario } from "@/lib/db/schema"
import { ESTADOS_QUE_LIBERAN_HORARIO, type EstadoCita, type Intervalo } from "./intervalos"
import type { FranjaConUbicacion } from "./reglas"
import type { CitaAgendada, DiaSemana } from "./slots"
import type { UbicacionCita } from "./ubicacion"

export type DoctorReservable = { id: string; nombre: string; especialidad: string }

/** Doctor aprobado con los datos que necesita una reserva, o `undefined` si no existe o no está aprobado. */
export async function doctorReservable(doctorId: string): Promise<DoctorReservable | undefined> {
    const [fila] = await db
        .select({ id: doctor.id, nombre: usuario.name, especialidad: especialidad.nombre })
        .from(doctor)
        .innerJoin(usuario, eq(doctor.usuarioId, usuario.id))
        .innerJoin(especialidad, eq(doctor.especialidadId, especialidad.id))
        .where(and(eq(doctor.id, doctorId), eq(doctor.aprobado, true)))
        .limit(1)
    return fila
}

/** Ubicación si pertenece al doctor, o `undefined` si no existe o es de otro doctor. */
export async function ubicacionDelDoctor(ubicacionId: string, doctorId: string): Promise<UbicacionCita | undefined> {
    const [fila] = await db
        .select({ nombre: ubicacion.nombre, direccion: ubicacion.direccion, colonia: ubicacion.colonia, ciudad: ubicacion.ciudad })
        .from(ubicacion)
        .where(and(eq(ubicacion.id, ubicacionId), eq(ubicacion.doctorId, doctorId)))
        .limit(1)
    return fila
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

/** Bloqueos del doctor que traslapan `rango` (intervalos semiabiertos). */
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

/**
 * Citas del doctor que ocupan horario y traslapan `rango`, aunque empiecen antes
 * o terminen después de él.
 */
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

/**
 * Inserta la cita. Puede lanzar la violación de `cita_sin_traslape_por_doctor`
 * si otra petición reservó un horario traslapado al mismo tiempo.
 */
export async function insertarCita(valores: NuevaCita): Promise<CitaRegistrada> {
    const [nueva] = await db.insert(cita).values(valores).returning()
    if (!nueva) throw new Error("La inserción de la cita no devolvió filas")
    return nueva
}

export async function citaPorId(id: string): Promise<CitaRegistrada | undefined> {
    const [fila] = await db.select().from(cita).where(eq(cita.id, id)).limit(1)
    return fila
}

/** Cita de invitado cuyo token de gestión tiene este hash SHA-256. */
export async function citaPorTokenHash(hash: string): Promise<CitaRegistrada | undefined> {
    const [fila] = await db.select().from(cita).where(eq(cita.tokenGestionHash, hash)).limit(1)
    return fila
}

/** Indica si el usuario es el doctor `doctorId` o uno de sus secretarios. */
export async function esPersonalDelDoctor(usuarioId: string, doctorId: string): Promise<boolean> {
    const [fila] = await db
        .select({ id: doctor.id })
        .from(doctor)
        .where(
            and(
                eq(doctor.id, doctorId),
                or(
                    eq(doctor.usuarioId, usuarioId),
                    sql`exists (select 1 from ${secretario} where ${secretario.doctorId} = ${doctor.id} and ${secretario.usuarioId} = ${usuarioId})`,
                ),
            ),
        )
        .limit(1)
    return fila !== undefined
}

export type CambiosAplicables = Partial<Pick<NuevaCita, "estado" | "motivoConsulta" | "notas">>

/**
 * Aplica `cambios` solo si la cita sigue en `estadoEsperado` (control optimista):
 * si otra petición cambió el estado entre la lectura y la escritura, devuelve `undefined`.
 */
export async function actualizarCitaSiEstado(
    id: string,
    estadoEsperado: EstadoCita,
    cambios: CambiosAplicables,
): Promise<CitaRegistrada | undefined> {
    const [fila] = await db
        .update(cita)
        .set({ ...cambios, actualizadoEn: new Date() })
        .where(and(eq(cita.id, id), eq(cita.estado, estadoEsperado)))
        .returning()
    return fila
}
