// Representaciones seguras de un doctor para responder al cliente (puro, sin I/O). Ver dto.test.ts.

import type { doctor } from "@/lib/db/schema"

type FilaDoctor = typeof doctor.$inferSelect

/**
 * Perfil de doctor como lo ve su propio dueño o un admin: sin el token de
 * Google ni el id del calendario.
 */
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
