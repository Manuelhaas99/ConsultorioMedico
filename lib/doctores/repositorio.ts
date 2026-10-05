import "server-only"
import { and, asc, eq, gt, sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db/client"
import {
    bloqueoHorario,
    disponibilidadDoctor,
    doctor,
    especialidad,
    secretario,
    tipoConsulta,
    ubicacion,
    usuario,
} from "@/lib/db/schema"
import type { Rol } from "@/lib/auth/roles"
import type { FilaDoctorDirectorio, FilasPerfil } from "./dto"
import { rolTrasAprobacion } from "./politica"

export type FilaDoctor = typeof doctor.$inferSelect
export type NuevoDoctor = Pick<typeof doctor.$inferInsert, "usuarioId" | "especialidadId" | "cedula" | "bio">

export async function doctorDeUsuario(usuarioId: string): Promise<{ id: string } | undefined> {
    const [fila] = await db.select({ id: doctor.id }).from(doctor).where(eq(doctor.usuarioId, usuarioId)).limit(1)
    return fila
}

export async function doctorPorCedula(cedula: string): Promise<{ id: string } | undefined> {
    const [fila] = await db.select({ id: doctor.id }).from(doctor).where(eq(doctor.cedula, cedula)).limit(1)
    return fila
}

export async function insertarDoctor(valores: NuevoDoctor): Promise<FilaDoctor> {
    const [fila] = await db
        .insert(doctor)
        .values({ ...valores, aprobado: false })
        .returning()
    if (!fila) throw new Error("La inserción del doctor no devolvió filas")
    return fila
}

/** La fila del usuario se bloquea para que un cambio de rol simultáneo no se pierda. Idempotente. */
export async function aprobarDoctorYAsignarRol(doctorId: string): Promise<{ doctor: FilaDoctor; rol: Rol } | undefined> {
    return db.transaction(async (tx) => {
        const [aprobado] = await tx.update(doctor).set({ aprobado: true }).where(eq(doctor.id, doctorId)).returning()
        if (!aprobado) return undefined

        const [usuarioActual] = await tx
            .select({ rol: usuario.rol })
            .from(usuario)
            .where(eq(usuario.id, aprobado.usuarioId))
            .for("update")
        if (!usuarioActual) throw new Error("El doctor apunta a un usuario inexistente")

        const rol = rolTrasAprobacion(usuarioActual.rol)
        if (rol !== usuarioActual.rol) {
            await tx.update(usuario).set({ rol, updatedAt: new Date() }).where(eq(usuario.id, aprobado.usuarioId))
        }
        return { doctor: aprobado, rol }
    })
}

const columnasDirectorio = {
    id: doctor.id,
    bio: doctor.bio,
    cedula: doctor.cedula,
    especialidadId: doctor.especialidadId,
    aprobado: doctor.aprobado,
    especialidadNombre: especialidad.nombre,
    nombre: usuario.name,
    imagen: usuario.image,
}

export type FiltrosDirectorio = { especialidadId?: string; ciudad?: string }

/**
 * Doctores aprobados, opcionalmente de una especialidad y con algún consultorio
 * en `ciudad` (comparación sin distinguir mayúsculas ni espacios en los extremos).
 */
export async function doctoresAprobados({ especialidadId, ciudad }: FiltrosDirectorio): Promise<FilaDoctorDirectorio[]> {
    const condiciones: SQL[] = [eq(doctor.aprobado, true)]
    if (especialidadId) condiciones.push(eq(doctor.especialidadId, especialidadId))
    if (ciudad) {
        condiciones.push(
            sql`exists (select 1 from ${ubicacion} where ${ubicacion.doctorId} = ${doctor.id} and lower(trim(${ubicacion.ciudad})) = lower(${ciudad}))`,
        )
    }
    return db
        .select(columnasDirectorio)
        .from(doctor)
        .innerJoin(usuario, eq(doctor.usuarioId, usuario.id))
        .innerJoin(especialidad, eq(doctor.especialidadId, especialidad.id))
        .where(and(...condiciones))
        .orderBy(asc(usuario.name))
}

/**
 * Lo necesario para decidir cómo ve al doctor `usuarioId` (o un anónimo si es
 * `null`): si está aprobado, si es su dueño y si es uno de sus secretarios.
 * `undefined` si el doctor no existe.
 */
export async function relacionConDoctor(
    doctorId: string,
    usuarioId: string | null,
): Promise<{ aprobado: boolean; esDueno: boolean; esSecretario: boolean } | undefined> {
    const [fila] = await db
        .select({
            aprobado: doctor.aprobado,
            esDueno: usuarioId === null ? sql<boolean>`false` : sql<boolean>`${doctor.usuarioId} = ${usuarioId}`,
            esSecretario:
                usuarioId === null
                    ? sql<boolean>`false`
                    : sql<boolean>`exists (select 1 from ${secretario} where ${secretario.doctorId} = ${doctor.id} and ${secretario.usuarioId} = ${usuarioId})`,
        })
        .from(doctor)
        .where(eq(doctor.id, doctorId))
        .limit(1)
    return fila
}

/** Doctor con su usuario, especialidad, consultorios, disponibilidad y tipos de consulta. */
export async function filasPerfil(doctorId: string): Promise<FilasPerfil | undefined> {
    const [fila] = await db
        .select(columnasDirectorio)
        .from(doctor)
        .innerJoin(usuario, eq(doctor.usuarioId, usuario.id))
        .innerJoin(especialidad, eq(doctor.especialidadId, especialidad.id))
        .where(eq(doctor.id, doctorId))
        .limit(1)
    if (!fila) return undefined

    const [ubicaciones, disponibilidad, tiposConsulta] = await Promise.all([
        db.select().from(ubicacion).where(eq(ubicacion.doctorId, doctorId)),
        db.select().from(disponibilidadDoctor).where(eq(disponibilidadDoctor.doctorId, doctorId)),
        db.select().from(tipoConsulta).where(eq(tipoConsulta.doctorId, doctorId)),
    ])
    return { doctor: fila, ubicaciones, disponibilidad, tiposConsulta }
}

export async function disponibilidadDe(doctorId: string): Promise<(typeof disponibilidadDoctor.$inferSelect)[]> {
    return db.select().from(disponibilidadDoctor).where(eq(disponibilidadDoctor.doctorId, doctorId))
}

/** Bloqueos del doctor, ordenados por inicio; con `terminanDespuesDe`, solo los que no han terminado. */
export async function bloqueosDe(
    doctorId: string,
    terminanDespuesDe?: Date,
): Promise<(typeof bloqueoHorario.$inferSelect)[]> {
    const condiciones: SQL[] = [eq(bloqueoHorario.doctorId, doctorId)]
    if (terminanDespuesDe) condiciones.push(gt(bloqueoHorario.fechaFin, terminanDespuesDe))
    return db
        .select()
        .from(bloqueoHorario)
        .where(and(...condiciones))
        .orderBy(asc(bloqueoHorario.fechaInicio))
}
