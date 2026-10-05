import type { doctor } from "@/lib/db/schema"

type FilaDoctor = typeof doctor.$inferSelect

/** Para su dueño o un admin: sin el token de Google ni el id del calendario. */
export type DoctorPropioDto = Pick<FilaDoctor, "id" | "usuarioId" | "especialidadId" | "cedula" | "bio" | "aprobado" | "creadoEn">

export function doctorPropio(d: FilaDoctor): DoctorPropioDto {
    return {
        id: d.id,
        usuarioId: d.usuarioId,
        especialidadId: d.especialidadId,
        cedula: d.cedula,
        bio: d.bio,
        aprobado: d.aprobado,
        creadoEn: d.creadoEn,
    }
}
