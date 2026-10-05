import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { doctor, usuario } from "@/lib/db/schema"
import type { Rol } from "@/lib/auth/roles"
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

/** Inserta la solicitud siempre como no aprobada; el rol del usuario no cambia. */
export async function insertarDoctor(valores: NuevoDoctor): Promise<FilaDoctor> {
    const [fila] = await db
        .insert(doctor)
        .values({ ...valores, aprobado: false })
        .returning()
    if (!fila) throw new Error("La inserción del doctor no devolvió filas")
    return fila
}

/**
 * Aprueba al doctor y ajusta el rol de su usuario en una sola transacción, con
 * la fila del usuario bloqueada para que un cambio de rol simultáneo no se pierda.
 * Devuelve `undefined` si el doctor no existe. Es idempotente.
 */
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
