import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { cita } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"
import {enviarConfirmacionCita} from "@/lib/email/send";
import {programarRecordatorios} from "@/lib/queue/reminders";
import { crearCitaSchema } from "@/lib/citas/schemas"
import { crearCita, type ErrorCrearCita } from "@/lib/citas/servicio"
import { errorJson, leerCuerpo } from "@/lib/http"
import { citaParaPaciente } from "@/lib/citas/dto"

// GET /api/appointments — lista de citas del usuario
export async function GET(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json(
                { message: "No autenticado" },
                { status: 401 }
            )
        }

        const citas = await db
            .select()
            .from(cita)
            .where(eq(cita.pacienteId, session.user.id))

        return NextResponse.json({ citas: citas.map(citaParaPaciente) })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al obtener citas" },
            { status: 500 }
        )
    }
}

const RESPUESTAS_ERROR = {
    RANGO_INVALIDO: [400, "La fecha de fin debe ser posterior a la de inicio"],
    FECHA_EN_PASADO: [400, "La cita debe ser en una fecha y hora futura"],
    DURACION_INVALIDA: [400, "La duración no coincide con el tipo de consulta o está fuera de los límites permitidos"],
    DATOS_INVITADO_REQUERIDOS: [400, "Nombre y email son requeridos para reservar como invitado"],
    UBICACION_INVALIDA: [400, "La ubicación no pertenece a este doctor"],
    TIPO_CONSULTA_INVALIDO: [400, "El tipo de consulta no pertenece a este doctor"],
    DOCTOR_NO_ENCONTRADO: [404, "Doctor no encontrado o no aprobado"],
    FUERA_DE_DISPONIBILIDAD: [409, "El horario está fuera de la disponibilidad del doctor"],
    HORARIO_BLOQUEADO: [409, "El doctor no atiende en ese horario"],
    HORARIO_OCUPADO: [409, "El horario seleccionado ya está ocupado"],
} as const satisfies Record<ErrorCrearCita, readonly [number, string]>

// POST /api/appointments — crear cita
export async function POST(request: NextRequest) {
    const cuerpo = await leerCuerpo(request, crearCitaSchema)
    if (!cuerpo.ok) return cuerpo.response

    try {
        const session = await getSession()
        const usuario = session
            ? { id: session.user.id, name: session.user.name, email: session.user.email }
            : null
        const resultado = await crearCita(cuerpo.data, { usuario })
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR[resultado.error]
            return errorJson(status, message)
        }
        const { cita: nuevaCita, contacto } = resultado

        // Enviar email de confirmación
        try {
            await enviarConfirmacionCita({
                email: contacto.email,
                nombrePaciente: contacto.nombre,
                nombreDoctor: resultado.doctor.nombre,
                especialidad: "Odontología",
                fechaInicio: nuevaCita.fechaInicio,
                fechaFin: nuevaCita.fechaFin,
                tokenGestion: resultado.tokenGestion ?? undefined,
            })
        } catch (emailError) {
            console.error("Error enviando email:", emailError)
            // No fallamos la cita si el email falla
        }

        // Programar recordatorios
        try {
            await programarRecordatorios({ citaId: nuevaCita.id, fechaInicio: nuevaCita.fechaInicio })
        } catch (qstashError) {
            console.error("Error programando recordatorios:", qstashError)
            // No fallamos la cita si QStash falla
        }

        return NextResponse.json(
            {
                message: "Cita agendada correctamente",
                cita: citaParaPaciente(nuevaCita),
                // Única vez que se entrega el token en claro (solo invitados); la base guarda su hash.
                ...(resultado.tokenGestion && { tokenGestion: resultado.tokenGestion }),
            },
            { status: 201 }
        )
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al crear cita")
    }
}
