import "server-only"
import { env } from "@/lib/env"
import { getResend } from "./client"
import { resolverRemitente } from "./remitente"
import {
    asuntoCodigo,
    asuntoConfirmacion,
    asuntoEnlaceAcceso,
    asuntoRecordatorio,
    enlaceDeLaApp,
    templateCodigo,
    templateConfirmacionCita,
    templateEnlaceAcceso,
    templateRecordatorioCita,
    textoCodigo,
    textoEnlaceAcceso,
    type EstadoConfirmacion,
    type PropositoCodigo,
} from "./templates"

/** Resend no lanza: devuelve `{ error }`. */
export class EnvioCorreoError extends Error {
    constructor(mensaje: string) {
        super(mensaje)
        this.name = "EnvioCorreoError"
    }
}

type CorreoSaliente = { to: string; subject: string; html: string; text?: string; idempotencyKey?: string }

async function enviar({ to, subject, html, text, idempotencyKey }: CorreoSaliente): Promise<{ id: string }> {
    const from = resolverRemitente(env("correo"))
    const { data, error } = await getResend().emails.send(
        { from, to, subject, html, ...(text ? { text } : {}) },
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
            baseUrl: env("app").BETTER_AUTH_URL,
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
            baseUrl: env("app").BETTER_AUTH_URL,
        }),
        idempotencyKey,
    })
}

export async function enviarCodigo({
    email,
    codigo,
    proposito,
    minutosVigencia,
}: {
    email: string
    codigo: string
    proposito: PropositoCodigo
    minutosVigencia: number
}) {
    return enviar({
        to: email,
        subject: asuntoCodigo(proposito),
        html: templateCodigo({ codigo, proposito, minutosVigencia }),
        text: textoCodigo({ codigo, proposito, minutosVigencia }),
    })
}

export async function enviarEnlaceAcceso({ email, url, minutosVigencia }: { email: string; url: string; minutosVigencia: number }) {
    const baseUrl = env("app").BETTER_AUTH_URL
    if (!enlaceDeLaApp(url, baseUrl)) throw new EnvioCorreoError("El enlace de acceso no es del origen de la app")
    return enviar({
        to: email,
        subject: asuntoEnlaceAcceso(),
        html: templateEnlaceAcceso({ url, minutosVigencia, baseUrl }),
        text: textoEnlaceAcceso({ url, minutosVigencia, baseUrl }),
    })
}
