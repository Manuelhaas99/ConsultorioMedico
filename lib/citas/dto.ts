import type { CitaRegistrada } from "./repositorio"
import type { RolEnCita } from "./politica"

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
