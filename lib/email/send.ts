import "server-only"
import { getResend } from "./client"
import { asuntoConfirmacion, asuntoRecordatorio, templateConfirmacionCita, templateRecordatorioCita } from "./templates"

const FROM = "Citas Médicas <onboarding@resend.dev>"

/** Resend rechazó el envío (Resend no lanza: devuelve `{ error }`). */
export class EnvioCorreoError extends Error {
    constructor(mensaje: string) {
        super(mensaje)
        this.name = "EnvioCorreoError"
    }
}

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
    return getResend().emails.send({
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
                                                 idempotencyKey,
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
    /** Misma clave = mismo correo: Resend no lo reenvía si un reintento repite la petición. */
    idempotencyKey: string
}): Promise<{ id: string }> {
    const { data, error } = await getResend().emails.send({
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
    }, { idempotencyKey })
    if (error) throw new EnvioCorreoError(`Resend rechazó el recordatorio: ${error.message}`)
    return { id: data.id }
}