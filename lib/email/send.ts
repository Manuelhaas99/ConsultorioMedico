import { resend } from "./client"
import { templateConfirmacionCita, templateRecordatorioCita } from "./templates"

const FROM = "Citas Médicas <onboarding@resend.dev>"

export async function enviarConfirmacionCita({
                                                 email,
                                                 nombrePaciente,
                                                 nombreDoctor,
                                                 especialidad,
                                                 fechaInicio,
                                                 fechaFin,
                                                 direccion,
                                                 tokenGestion,
                                             }: {
    email: string
    nombrePaciente: string
    nombreDoctor: string
    especialidad: string
    fechaInicio: Date
    fechaFin: Date
    direccion?: string
    tokenGestion?: string
}) {
    return resend.emails.send({
        from: FROM,
        to: email,
        subject: `Cita confirmada con ${nombreDoctor}`,
        html: templateConfirmacionCita({
            nombrePaciente,
            nombreDoctor,
            especialidad,
            fechaInicio,
            fechaFin,
            direccion,
            tokenGestion,
        }),
    })
}

export async function enviarRecordatorioCita({
                                                 email,
                                                 nombrePaciente,
                                                 nombreDoctor,
                                                 especialidad,
                                                 fechaInicio,
                                                 fechaFin,
                                                 direccion,
                                                 tokenGestion,
                                                 tiempoRestante,
                                                 citaId,
                                             }: {
    email: string
    nombrePaciente: string
    nombreDoctor: string
    especialidad: string
    fechaInicio: Date
    fechaFin: Date
    direccion?: string
    tokenGestion?: string
    tiempoRestante: "24h" | "1h"
    citaId: string
}) {
    return resend.emails.send({
        from: FROM,
        to: email,
        subject: `Recordatorio: cita con ${nombreDoctor} en ${tiempoRestante === "24h" ? "24 horas" : "1 hora"}`,
        html: templateRecordatorioCita({
            nombrePaciente,
            nombreDoctor,
            especialidad,
            fechaInicio,
            fechaFin,
            direccion,
            tokenGestion,
            tiempoRestante,
            citaId,
        }),
    })
}