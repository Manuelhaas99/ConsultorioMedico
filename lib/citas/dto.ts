// Representaciones seguras de una cita para responder al cliente (puro, sin I/O).

import type { CitaRegistrada } from "./repositorio"
import type { RolEnCita } from "./politica"

/** Cita como la ve el paciente: sin token de gestión ni notas internas del personal. */
export type CitaPacienteDto = Pick<
    CitaRegistrada,
    | "id"
    | "doctorId"
    | "pacienteId"
    | "ubicacionId"
    | "tipoConsultaId"
    | "invitadoNombre"
    | "invitadoEmail"
    | "invitadoTelefono"
    | "fechaInicio"
    | "fechaFin"
    | "estado"
    | "motivoConsulta"
    | "creadoEn"
    | "actualizadoEn"
>

/** Cita como la ve el doctor o su secretario: incluye notas y asistencia. */
export type CitaPersonalDto = CitaPacienteDto & Pick<CitaRegistrada, "notas" | "asistio">

export function citaParaPaciente(c: CitaRegistrada): CitaPacienteDto {
    return {
        id: c.id,
        doctorId: c.doctorId,
        pacienteId: c.pacienteId,
        ubicacionId: c.ubicacionId,
        tipoConsultaId: c.tipoConsultaId,
        invitadoNombre: c.invitadoNombre,
        invitadoEmail: c.invitadoEmail,
        invitadoTelefono: c.invitadoTelefono,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        estado: c.estado,
        motivoConsulta: c.motivoConsulta,
        creadoEn: c.creadoEn,
        actualizadoEn: c.actualizadoEn,
    }
}

export function citaParaPersonal(c: CitaRegistrada): CitaPersonalDto {
    return { ...citaParaPaciente(c), notas: c.notas, asistio: c.asistio }
}

export function citaParaRol(c: CitaRegistrada, rol: RolEnCita): CitaPacienteDto | CitaPersonalDto {
    return rol === "personal" ? citaParaPersonal(c) : citaParaPaciente(c)
}
