import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { cita, doctor, usuario } from "@/lib/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"
import { randomBytes } from "crypto"

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
            .select()
            .from(doctor)
            .where(and(eq(doctor.id, doctorId), eq(doctor.aprobado, true)))
            .limit(1)


        if (!doctorData) {
            return NextResponse.json(
                { message: "Doctor no encontrado o no aprobado" },
                { status: 404 }
            )
        }

        // Verificar que el slot no está ocupado
        const citaExistente = await db
            .select()
            .from(cita)
            .where(
                and(
                    eq(cita.doctorId, doctorId),
                    lte(cita.fechaInicio, new Date(fechaFin)),
                    gte(cita.fechaFin, new Date(fechaInicio))
                )
            )
            .limit(1)

        if (citaExistente.length > 0) {
            return NextResponse.json(
                { message: "El horario seleccionado ya está ocupado" },
                { status: 409 }
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

        const [nuevaCita] = await db
            .insert(cita)
            .values({
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
            .returning()

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

