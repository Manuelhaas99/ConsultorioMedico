import "server-only"
import { enviarRecordatorioCita } from "@/lib/email/send"
import { claveRecordatorio, motivoParaOmitir, type MotivoOmision } from "./reglas"
import { datosParaRecordatorio, liberarEnvio, reservarEnvio } from "./repositorio"
import type { MensajeRecordatorio } from "./schemas"

export type ResultadoRecordatorio =
    | { enviado: true }
    | { enviado: false; motivo: MotivoOmision | "NO_ENCONTRADA" }

/**
 * Procesa un recordatorio entregado por QStash.
 *
 * 1. Omite si la cita no existe, ya no está activa, cambió de horario o ya se avisó.
 * 2. Marca el envío con un UPDATE condicional ANTES de enviar: si QStash entrega
 *    el mismo mensaje dos veces (reintento o entrega duplicada), solo una gana.
 * 3. Si el correo falla, revierte la marca y relanza para que QStash reintente.
 *
 * Errores inesperados (base, Resend) se lanzan; el handler responde 500.
 */
export async function procesarRecordatorio(mensaje: MensajeRecordatorio): Promise<ResultadoRecordatorio> {
    const datos = await datosParaRecordatorio(mensaje.citaId)
    if (!datos) return { enviado: false, motivo: "NO_ENCONTRADA" }

    const motivo = motivoParaOmitir(datos, mensaje)
    if (motivo) return { enviado: false, motivo }
    // motivoParaOmitir ya descartó SIN_DESTINATARIO; se repite para que TypeScript lo sepa.
    if (!datos.emailDestinatario) return { enviado: false, motivo: "SIN_DESTINATARIO" }

    const ganado = await reservarEnvio(datos.id, mensaje.tipo, mensaje.fechaInicio)
    if (!ganado) return { enviado: false, motivo: "YA_ENVIADO" }

    try {
        await enviarRecordatorioCita({
            email: datos.emailDestinatario,
            nombrePaciente: datos.nombrePaciente,
            nombreDoctor: datos.nombreDoctor,
            especialidad: datos.especialidad,
            fechaInicio: datos.fechaInicio,
            fechaFin: datos.fechaFin,
            // Solo se guarda el hash del token: el recordatorio de un invitado no puede incluir su enlace.
            invitado: datos.invitado,
            tiempoRestante: mensaje.tipo,
            citaId: datos.id,
            idempotencyKey: claveRecordatorio(mensaje),
        })
    } catch (error) {
        await liberarEnvio(datos.id, mensaje.tipo)
        throw error
    }
    return { enviado: true }
}
