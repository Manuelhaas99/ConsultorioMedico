import { resend } from "./client"
import { asuntoConfirmacion, asuntoRecordatorio, templateConfirmacionCita, templateRecordatorioCita } from "./templates"

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
        subject: asuntoConfirmacion(nombreDoctor),
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
                                                 invitado,
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
    invitado: boolean
    tiempoRestante: "24h" | "1h"
    citaId: string
}) {
    return resend.emails.send({
        from: FROM,
        to: email,
        subject: asuntoRecordatorio(nombreDoctor, tiempoRestante),
        html: templateRecordatorioCita({
            nombrePaciente,
            nombreDoctor,
            especialidad,
            fechaInicio,
            fechaFin,
            direccion,
            invitado,
            tiempoRestante,
            citaId,
        }),
    })
}