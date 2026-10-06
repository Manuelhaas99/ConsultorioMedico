import type { bloqueoHorario, disponibilidadDoctor, doctor, tipoConsulta, ubicacion } from "@/lib/db/schema"
import type { VistaDoctor } from "./politica"

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

export type FilaDoctorDirectorio = Pick<FilaDoctor, "id" | "bio" | "cedula" | "especialidadId" | "aprobado"> & {
    especialidadNombre: string
    nombre: string
    imagen: string | null
}

/** La cédula profesional es pública (registro de la SEP); el correo no. */
export type DoctorPublicoDto = {
    id: string
    nombre: string
    imagen: string | null
    bio: string | null
    cedula: string
    especialidadId: string
    especialidadNombre: string
}

export function doctorPublico(d: FilaDoctorDirectorio): DoctorPublicoDto {
    return {
        id: d.id,
        nombre: d.nombre,
        imagen: d.imagen,
        bio: d.bio,
        cedula: d.cedula,
        especialidadId: d.especialidadId,
        especialidadNombre: d.especialidadNombre,
    }
}

type FilaUbicacion = typeof ubicacion.$inferSelect
type FilaDisponibilidad = typeof disponibilidadDoctor.$inferSelect
type FilaTipoConsulta = typeof tipoConsulta.$inferSelect

export type UbicacionPublicaDto = Pick<FilaUbicacion, "id" | "nombre" | "direccion" | "ciudad" | "colonia" | "urlMapa">
export type DisponibilidadPublicaDto = Pick<FilaDisponibilidad, "id" | "diaSemana" | "horaInicio" | "horaFin" | "ubicacionId">
export type TipoConsultaPublicoDto = Pick<FilaTipoConsulta, "id" | "nombre" | "duracionMinutos">

export function ubicacionPublica(u: FilaUbicacion): UbicacionPublicaDto {
    return { id: u.id, nombre: u.nombre, direccion: u.direccion, ciudad: u.ciudad, colonia: u.colonia, urlMapa: u.urlMapa }
}

export function disponibilidadPublica(d: FilaDisponibilidad): DisponibilidadPublicaDto {
    return { id: d.id, diaSemana: d.diaSemana, horaInicio: d.horaInicio, horaFin: d.horaFin, ubicacionId: d.ubicacionId }
}

export function tipoConsultaPublico(t: FilaTipoConsulta): TipoConsultaPublicoDto {
    return { id: t.id, nombre: t.nombre, duracionMinutos: t.duracionMinutos }
}

export type PerfilDoctorDto = DoctorPublicoDto & {
    ubicaciones: UbicacionPublicaDto[]
    disponibilidad: DisponibilidadPublicaDto[]
    tiposConsulta: TipoConsultaPublicoDto[]
    aprobado?: boolean
}

export type FilasPerfil = {
    doctor: FilaDoctorDirectorio
    ubicaciones: FilaUbicacion[]
    disponibilidad: FilaDisponibilidad[]
    tiposConsulta: FilaTipoConsulta[]
}

export function perfilDoctor(filas: FilasPerfil, vista: VistaDoctor): PerfilDoctorDto {
    return {
        ...doctorPublico(filas.doctor),
        ubicaciones: filas.ubicaciones.map(ubicacionPublica),
        disponibilidad: filas.disponibilidad.map(disponibilidadPublica),
        tiposConsulta: filas.tiposConsulta.map(tipoConsultaPublico),
        ...(vista !== "publica" && { aprobado: filas.doctor.aprobado }),
    }
}

type FilaBloqueo = typeof bloqueoHorario.$inferSelect

export type BloqueoPublicoDto = { fechaInicio: Date; fechaFin: Date }

export type BloqueoPersonalDto = Pick<FilaBloqueo, "id" | "fechaInicio" | "fechaFin" | "motivo" | "creadoEn">

export function bloqueoPublico(b: Pick<FilaBloqueo, "fechaInicio" | "fechaFin">): BloqueoPublicoDto {
    return { fechaInicio: b.fechaInicio, fechaFin: b.fechaFin }
}

export function bloqueoPersonal(b: FilaBloqueo): BloqueoPersonalDto {
    return { id: b.id, fechaInicio: b.fechaInicio, fechaFin: b.fechaFin, motivo: b.motivo, creadoEn: b.creadoEn }
}

export function bloqueoParaVista(b: FilaBloqueo, vista: VistaDoctor): BloqueoPublicoDto | BloqueoPersonalDto {
    return vista === "personal" ? bloqueoPersonal(b) : bloqueoPublico(b)
}
