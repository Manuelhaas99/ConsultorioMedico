import { formatearIntervalo, ZONA_CONSULTORIO } from "@/lib/citas/zona-horaria"
import { construirUrl, html, textoDeUnaLinea } from "./html"

type ConfirmacionCitaProps = {
    nombrePaciente: string
    nombreDoctor: string
    especialidad: string
    fechaInicio: Date
    fechaFin: Date
    direccion?: string
    tokenGestion?: string
    zona?: string
    /** Por defecto `BETTER_AUTH_URL`. */
    baseUrl?: string
}

export function templateConfirmacionCita({
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

    const linkGestion = tokenGestion ? construirUrl(baseUrl, "/cita", { token: tokenGestion }) : null

    return html`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Cita confirmada</h2>
      <p>Hola <strong>${nombrePaciente}</strong>,</p>
      <p>Tu cita ha sido agendada correctamente.</p>

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

type RecordatorioCitaProps = ConfirmacionCitaProps & {
    tiempoRestante: "24h" | "1h"
    citaId: string
}

export function templateRecordatorioCita({
    nombrePaciente,
    nombreDoctor,
    especialidad,
    fechaInicio,
    fechaFin,
    direccion,
    tokenGestion,
    tiempoRestante,
    zona = ZONA_CONSULTORIO,
    baseUrl = process.env.BETTER_AUTH_URL,
}: RecordatorioCitaProps): string {
    const { fecha, horaInicio } = formatearIntervalo(fechaInicio, fechaFin, zona)

    const linkCancelar = tokenGestion
        ? construirUrl(baseUrl, "/cita", { token: tokenGestion, accion: "cancelar" })
        : construirUrl(baseUrl, "/mis-citas")

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
    </div>
  `.toString()
}

export function asuntoConfirmacion(nombreDoctor: string): string {
    return textoDeUnaLinea(`Cita confirmada con ${nombreDoctor}`)
}

export function asuntoRecordatorio(nombreDoctor: string, tiempoRestante: "24h" | "1h"): string {
    return textoDeUnaLinea(`Recordatorio: cita con ${nombreDoctor} en ${tiempoRestante === "24h" ? "24 horas" : "1 hora"}`)
}
