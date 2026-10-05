import type { EstadoCita } from "@/lib/citas/intervalos"
import { formatearIntervalo, ZONA_CONSULTORIO } from "@/lib/citas/zona-horaria"
import { construirUrl, html, textoDeUnaLinea } from "./html"

/** Estados con los que se notifica una cita recién creada. */
export type EstadoConfirmacion = Extract<EstadoCita, "pendiente" | "confirmada">

/**
 * Textos del correo según el estado real de la cita: una reserva queda
 * `pendiente` hasta que el consultorio la confirma, así que no se le dice
 * "confirmada" al paciente.
 */
export function textosConfirmacion(estado: EstadoConfirmacion): { titulo: string; mensaje: string } {
    return estado === "pendiente"
        ? {
              titulo: "Recibimos tu solicitud de cita",
              mensaje: "Registramos tu cita. El consultorio la revisará y te avisaremos si hay algún cambio.",
          }
        : { titulo: "Cita agendada", mensaje: "Tu cita quedó agendada y confirmada por el consultorio." }
}

// Todo valor interpolado pasa por la plantilla etiquetada `html`, que lo escapa:
// nombres, direcciones y demás datos los escribe el usuario (incluso un invitado sin cuenta).

type ConfirmacionCitaProps = {
    estado: EstadoConfirmacion
    nombrePaciente: string
    nombreDoctor: string
    especialidad: string
    fechaInicio: Date
    fechaFin: Date
    direccion?: string
    tokenGestion?: string
    /** Zona IANA del consultorio; el servidor corre en UTC, así que se formatea explícitamente. */
    zona?: string
    /** URL pública de la app para los enlaces. Por defecto `BETTER_AUTH_URL`. */
    baseUrl?: string
}

export function templateConfirmacionCita({
    estado,
    nombrePaciente,
    nombreDoctor,
    especialidad,
    fechaInicio,
    fechaFin,
    direccion,
    tokenGestion,
    zona = ZONA_CONSULTORIO,
    baseUrl = process.env.BETTER_AUTH_URL,
}: ConfirmacionCitaProps): string {
    const { fecha, horaInicio, horaFin } = formatearIntervalo(fechaInicio, fechaFin, zona)

    // El token va en el fragmento: no llega al servidor ni a Referer. La página /cita lo
    // lee en el cliente y llama a /api/appointments/gestion con Authorization: Bearer.
    const linkGestion = tokenGestion ? construirUrl(baseUrl, "/cita", {}, { token: tokenGestion }) : null
    const { titulo, mensaje } = textosConfirmacion(estado)

    return html`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">${titulo}</h2>
      <p>Hola <strong>${nombrePaciente}</strong>,</p>
      <p>${mensaje}</p>

      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Doctor:</strong> ${nombreDoctor}</p>
        <p><strong>Especialidad:</strong> ${especialidad}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Horario:</strong> ${horaInicio} - ${horaFin}</p>
        ${direccion && html`<p><strong>Dirección:</strong> ${direccion}</p>`}
      </div>

      ${
          linkGestion &&
          html`
        <p>Como agendaste sin cuenta, puedes gestionar tu cita desde este enlace:</p>
        <a href="${linkGestion}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Ver mi cita
        </a>
      `
      }

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Recibirás un recordatorio 24 horas y 1 hora antes de tu cita.
      </p>
    </div>
  `.toString()
}

type RecordatorioCitaProps = Omit<ConfirmacionCitaProps, "tokenGestion" | "estado"> & {
    tiempoRestante: "24h" | "1h"
    citaId: string
    /**
     * La cita es de un invitado sin cuenta. Como la base solo guarda el hash de su
     * token, el recordatorio no puede incluir el enlace de gestión.
     */
    invitado: boolean
}

export function templateRecordatorioCita({
    nombrePaciente,
    nombreDoctor,
    especialidad,
    fechaInicio,
    fechaFin,
    direccion,
    invitado,
    tiempoRestante,
    zona = ZONA_CONSULTORIO,
    baseUrl = process.env.BETTER_AUTH_URL,
}: RecordatorioCitaProps): string {
    const { fecha, horaInicio } = formatearIntervalo(fechaInicio, fechaFin, zona)

    const linkCancelar = invitado ? null : construirUrl(baseUrl, "/mis-citas")

    return html`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Recordatorio de cita</h2>
      <p>Hola <strong>${nombrePaciente}</strong>,</p>
      <p>Te recordamos que tienes una cita en <strong>${tiempoRestante === "24h" ? "24 horas" : "1 hora"}</strong>.</p>

      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Doctor:</strong> ${nombreDoctor}</p>
        <p><strong>Especialidad:</strong> ${especialidad}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Hora:</strong> ${horaInicio}</p>
        ${direccion && html`<p><strong>Dirección:</strong> ${direccion}</p>`}
      </div>

      ${
          linkCancelar &&
          html`
        <p>¿No puedes asistir?</p>
        <a href="${linkCancelar}" style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Cancelar cita
        </a>
      `
      }
      ${invitado && html`<p>¿No puedes asistir? Cancela desde el enlace de tu correo de confirmación.</p>`}
    </div>
  `.toString()
}

/** Asunto del correo de una cita recién creada, consistente con su estado, en una sola línea. */
export function asuntoConfirmacion(nombreDoctor: string, estado: EstadoConfirmacion): string {
    return textoDeUnaLinea(`${textosConfirmacion(estado).titulo} con ${nombreDoctor}`)
}

/** Asunto del recordatorio, en una sola línea. */
export function asuntoRecordatorio(nombreDoctor: string, tiempoRestante: "24h" | "1h"): string {
    return textoDeUnaLinea(`Recordatorio: cita con ${nombreDoctor} en ${tiempoRestante === "24h" ? "24 horas" : "1 hora"}`)
}
