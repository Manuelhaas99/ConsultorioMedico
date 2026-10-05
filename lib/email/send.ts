import "server-only"
import { env } from "@/lib/env"
import { getResend } from "./client"
import { resolverRemitente } from "./remitente"
import {
    asuntoConfirmacion,
    asuntoRecordatorio,
    templateConfirmacionCita,
    templateRecordatorioCita,
    type EstadoConfirmacion,
} from "./templates"

/** Resend no lanza: devuelve `{ error }`. */
export class EnvioCorreoError extends Error {
    constructor(mensaje: string) {
        super(mensaje)
        this.name = "EnvioCorreoError"
    }
}

type CorreoSaliente = { to: string; subject: string; html: string; idempotencyKey?: string }

/** Envía con el remitente configurado (EMAIL_FROM) y lanza `EnvioCorreoError` si Resend lo rechaza. */
async function enviar({ to, subject, html, idempotencyKey }: CorreoSaliente): Promise<{ id: string }> {
    const from = resolverRemitente(env("correo"))
    const { data, error } = await getResend().emails.send(
        { from, to, subject, html },
        idempotencyKey ? { idempotencyKey } : undefined,
    )
    if (error) throw new EnvioCorreoError(`Resend rechazó el correo: ${error.message}`)
    return { id: data.id }
}

export async function enviarConfirmacionCita({
    email,
    estado,
    nombrePaciente,
    nombreDoctor,
    especialidad,
    fechaInicio,
    fechaFin,
    direccion,
    tokenGestion,
}: {
    email: string
    estado: EstadoConfirmacion
    nombrePaciente: string
    nombreDoctor: string
    especialidad: string
    fechaInicio: Date
    fechaFin: Date
    direccion?: string
    tokenGestion?: string
}) {
    return enviar({
        to: email,
        subject: asuntoConfirmacion(nombreDoctor, estado),
        html: templateConfirmacionCita({
            estado,
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
    /** Resend no reenvía un correo con una clave ya usada. */
    idempotencyKey: string
}) {
    return enviar({
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
        idempotencyKey,
    })
}
