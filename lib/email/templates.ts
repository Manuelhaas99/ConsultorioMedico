import type { EstadoCita } from "@/lib/citas/intervalos"
import { formatearIntervalo, ZONA_CONSULTORIO } from "@/lib/citas/zona-horaria"
import { construirUrl, html, textoDeUnaLinea } from "./html"

export type EstadoConfirmacion = Extract<EstadoCita, "pendiente" | "confirmada">

export function textosConfirmacion(estado: EstadoConfirmacion): { titulo: string; mensaje: string } {
    return estado === "pendiente"
        ? {
              titulo: "Recibimos tu solicitud de cita",
              // No se promete avisar de cambios: hoy no existe ninguna notificación al cambiar el estado.
              mensaje: "Registramos tu cita. Queda pendiente hasta que el consultorio la confirme.",
          }
        : { titulo: "Cita agendada", mensaje: "Tu cita quedó agendada y confirmada por el consultorio." }
}

type ConfirmacionCitaProps = {
    estado: EstadoConfirmacion
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
    /** Sin enlace de gestión: la base solo guarda el hash del token. */
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

export function asuntoConfirmacion(nombreDoctor: string, estado: EstadoConfirmacion): string {
    return textoDeUnaLinea(`${textosConfirmacion(estado).titulo} con ${nombreDoctor}`)
}

export function asuntoRecordatorio(nombreDoctor: string, tiempoRestante: "24h" | "1h"): string {
    return textoDeUnaLinea(`Recordatorio: cita con ${nombreDoctor} en ${tiempoRestante === "24h" ? "24 horas" : "1 hora"}`)
}

const MARCA = "Citas Dentales"

export const ESTILO_BOTON =
    "display:inline-block; padding:14px 24px; background:#2563eb; color:#ffffff; border-radius:6px; text-decoration:none; font-weight:bold;"

// Oculto en el cuerpo, pero es lo que muestran la bandeja y las notificaciones en lugar del inicio del correo.
const ESTILO_PREHEADER = "display:none; max-height:0; overflow:hidden;"

function minutos(n: number): string {
    return `${n} ${n === 1 ? "minuto" : "minutos"}`
}

const AVISO_CODIGO_INICIO = "Si no pediste este código, ignora este correo."
const AVISO_CODIGO_FIN = "Nunca te lo pediremos por teléfono ni por mensaje."

export type PropositoCodigo = "iniciar-sesion" | "verificar-correo" | "restablecer-contrasena"

const TEXTOS_CODIGO: Record<PropositoCodigo, { asunto: string; titulo: string; intro: string; preheader: string; aviso: string }> = {
    "iniciar-sesion": {
        asunto: `Tu código para entrar a ${MARCA}`,
        titulo: "Tu código para entrar",
        intro: `Escribe este código en ${MARCA} para entrar.`,
        preheader: `Úsalo para entrar a ${MARCA}.`,
        aviso: `${AVISO_CODIGO_INICIO} Nadie puede entrar a tu cuenta sin él. ${AVISO_CODIGO_FIN}`,
    },
    "verificar-correo": {
        asunto: `Tu código para verificar tu correo en ${MARCA}`,
        titulo: "Tu código para verificar tu correo",
        intro: "Escribe este código para verificar tu correo.",
        preheader: `Úsalo para verificar tu correo en ${MARCA}.`,
        aviso: `${AVISO_CODIGO_INICIO} ${AVISO_CODIGO_FIN}`,
    },
    "restablecer-contrasena": {
        asunto: `Tu código para restablecer tu contraseña en ${MARCA}`,
        titulo: "Tu código para restablecer tu contraseña",
        intro: "Escribe este código para elegir una contraseña nueva.",
        preheader: `Úsalo para restablecer tu contraseña en ${MARCA}.`,
        aviso: `${AVISO_CODIGO_INICIO} ${AVISO_CODIGO_FIN}`,
    },
}

type CorreoCodigoProps = { codigo: string; proposito: PropositoCodigo; minutosVigencia: number }

export function asuntoCodigo(proposito: PropositoCodigo): string {
    return textoDeUnaLinea(TEXTOS_CODIGO[proposito].asunto)
}

export function templateCodigo({ codigo, proposito, minutosVigencia }: CorreoCodigoProps): string {
    const { titulo, intro, preheader, aviso } = TEXTOS_CODIGO[proposito]

    // La separación es solo visual (letter-spacing) para que el código se copie sin espacios.
    return html`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="${ESTILO_PREHEADER}">${preheader} Vence en ${minutos(minutosVigencia)}.</div>
      <h2 style="color: #2563eb;">${titulo}</h2>
      <p>${intro}</p>

      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding-left: 8px;">${codigo}</span>
      </div>

      <p>Vence en ${minutos(minutosVigencia)} y solo funciona una vez.</p>
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">${aviso}</p>
    </div>
  `.toString()
}

export function textoCodigo({ codigo, proposito, minutosVigencia }: CorreoCodigoProps): string {
    const { titulo, intro, aviso } = TEXTOS_CODIGO[proposito]
    return [titulo, intro, codigo, `Vence en ${minutos(minutosVigencia)} y solo funciona una vez.`, aviso].join("\n\n")
}

type CorreoEnlaceProps = {
    url: string
    minutosVigencia: number
    /** Por defecto `BETTER_AUTH_URL`. */
    baseUrl?: string
}

const TEXTOS_ENLACE = {
    asunto: `Tu enlace para entrar a ${MARCA}`,
    titulo: "Tu enlace para entrar",
    introHtml: `Toca el botón para entrar a ${MARCA}. El enlace sirve una sola vez.`,
    introTexto: `Abre este enlace para entrar a ${MARCA}. Sirve una sola vez:`,
    boton: `Entrar a ${MARCA}`,
    respaldo: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
    sinEnlace: `No pudimos generar tu enlace. Vuelve a ${MARCA} y pide uno nuevo.`,
    aviso: "Si no pediste este enlace, ignora este correo. Nunca te lo pediremos por teléfono ni por mensaje.",
}

function vigenciaEnlace(minutosVigencia: number): string {
    return `Vence en ${minutos(minutosVigencia)}. Ábrelo en el mismo teléfono o computadora donde lo pediste.`
}

/** Devuelve `null` si la URL no es http(s), no es del origen de la app o trae credenciales. */
export function enlaceDeLaApp(url: string, baseUrl: string | undefined = process.env.BETTER_AUTH_URL): string | null {
    const enlace = construirUrl(baseUrl, url)
    if (!enlace || !baseUrl) return null
    const destino = new URL(enlace)
    if (destino.username || destino.password) return null
    return destino.origin === new URL(baseUrl).origin ? enlace : null
}

export function asuntoEnlaceAcceso(): string {
    return textoDeUnaLinea(TEXTOS_ENLACE.asunto)
}

export function templateEnlaceAcceso({ url, minutosVigencia, baseUrl = process.env.BETTER_AUTH_URL }: CorreoEnlaceProps): string {
    const enlace = enlaceDeLaApp(url, baseUrl)

    return html`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${
          enlace
              ? html`
        <div style="${ESTILO_PREHEADER}">Úsalo para entrar a ${MARCA}. Vence en ${minutos(minutosVigencia)}.</div>
        <h2 style="color: #2563eb;">${TEXTOS_ENLACE.titulo}</h2>
        <p>${TEXTOS_ENLACE.introHtml}</p>
        <p style="margin: 20px 0;"><a href="${enlace}" style="${ESTILO_BOTON}">${TEXTOS_ENLACE.boton}</a></p>
        <p style="color:#6b7280; font-size:14px; word-break:break-all;">${TEXTOS_ENLACE.respaldo}<br>${enlace}</p>
        <p>${vigenciaEnlace(minutosVigencia)}</p>
      `
              : html`
        <h2 style="color: #2563eb;">${TEXTOS_ENLACE.titulo}</h2>
        <p>${TEXTOS_ENLACE.sinEnlace}</p>
      `
      }
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">${TEXTOS_ENLACE.aviso}</p>
    </div>
  `.toString()
}

export function textoEnlaceAcceso({ url, minutosVigencia, baseUrl = process.env.BETTER_AUTH_URL }: CorreoEnlaceProps): string {
    const enlace = enlaceDeLaApp(url, baseUrl)
    const cuerpo = enlace ? [TEXTOS_ENLACE.introTexto, enlace, vigenciaEnlace(minutosVigencia)] : [TEXTOS_ENLACE.sinEnlace]
    return [TEXTOS_ENLACE.titulo, ...cuerpo, TEXTOS_ENLACE.aviso].join("\n\n")
}
