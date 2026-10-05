import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { cita, doctor, usuario, especialidad } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"
import { randomBytes } from "crypto"
import {enviarConfirmacionCita} from "@/lib/email/send";
import {programarRecordatorios} from "@/lib/queue/reminders";
import { reservarCita } from "@/lib/citas/servicio"
import { errorJson } from "@/lib/http"

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

        return NextResponse.json({ citas })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al obtener citas" },
            { status: 500 }
        )
    }
}

// POST /api/appointments — crear cita
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            doctorId,
            fechaInicio,
            fechaFin,
            ubicacionId,
            tipoConsultaId,
            motivoConsulta,
            // Para invitados
            invitadoNombre,
            invitadoEmail,
            invitadoTelefono,
        } = body


        if (!doctorId || !fechaInicio || !fechaFin) {
            return NextResponse.json(
                { message: "Doctor, fecha inicio y fecha fin son requeridos" },
                { status: 400 }
            )
        }

        // Verificar que el doctor existe y está aprobado
        const [doctorData] = await db
            .select({
                id: doctor.id,
                aprobado: doctor.aprobado,
                usuarioId: doctor.usuarioId,
                nombre: usuario.name,
                especialidadNombre: especialidad.nombre,
            })
            .from(doctor)
            .innerJoin(usuario, eq(doctor.usuarioId, usuario.id))
            .innerJoin(especialidad, eq(doctor.especialidadId, especialidad.id))
            .where(and(eq(doctor.id, doctorId), eq(doctor.aprobado, true)))
            .limit(1)


        if (!doctorData) {
            return NextResponse.json(
                { message: "Doctor no encontrado o no aprobado" },
                { status: 404 }
            )
        }

        // Obtener sesión si existe (usuario registrado)
        const session = await getSession()

        // Validar que si no hay sesión, hay datos de invitado
        if (!session && (!invitadoNombre || !invitadoEmail)) {
            return NextResponse.json(
                { message: "Nombre y email son requeridos para reservar como invitado" },
                { status: 400 }
            )
        }

        // Generar token de gestión para invitados
        const tokenGestion = randomBytes(32).toString("hex")

        // La verificación de horario libre y la garantía ante reservas
        // simultáneas (restricción de exclusión en la base) viven en el servicio.
        const reserva = await reservarCita({
            doctorId,
            pacienteId: session?.user.id ?? null,
            ubicacionId: ubicacionId ?? null,
            tipoConsultaId: tipoConsultaId ?? null,
            invitadoNombre: session ? null : invitadoNombre,
            invitadoEmail: session ? null : invitadoEmail,
            invitadoTelefono: session ? null : (invitadoTelefono ?? null),
            fechaInicio: new Date(fechaInicio),
            fechaFin: new Date(fechaFin),
            estado: "pendiente",
            motivoConsulta: motivoConsulta ?? null,
            tokenGestion,
        })

        if (!reserva.ok) {
            return errorJson(409, "El horario seleccionado ya está ocupado")
        }
        const nuevaCita = reserva.cita

        // Enviar email de confirmación
        try {
            await enviarConfirmacionCita({
                email: session?.user.email ?? invitadoEmail,
                nombrePaciente: session?.user.name ?? invitadoNombre,
                nombreDoctor: doctorData.nombre ?? "Doctor",
                especialidad: "Odontología",
                fechaInicio: new Date(fechaInicio),
                fechaFin: new Date(fechaFin),
                tokenGestion: nuevaCita.tokenGestion ?? undefined,
            })
        } catch (emailError) {
            console.error("Error enviando email:", emailError)
            // No fallamos la cita si el email falla
        }

        // Programar recordatorios
        try {
            await programarRecordatorios({
                citaId: nuevaCita.id,
                fechaInicio: new Date(fechaInicio),
                emailPaciente: session?.user.email ?? invitadoEmail,
            })
        } catch (qstashError) {
            console.error("Error programando recordatorios:", qstashError)
            // No fallamos la cita si QStash falla
        }

        return NextResponse.json(
            {
                message: "Cita agendada correctamente",
                cita: nuevaCita,
                tokenGestion // para que el invitado pueda gestionar su cita
            },
            { status: 201 }
        )
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al crear cita" },
            { status: 500 }
        )
    }
}

