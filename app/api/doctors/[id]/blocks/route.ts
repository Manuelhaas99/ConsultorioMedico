import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { bloqueoHorario, doctor } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"

// GET /api/doctors/[id]/blocks — obtener bloqueos
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const bloqueos = await db
            .select()
            .from(bloqueoHorario)
            .where(eq(bloqueoHorario.doctorId, id))

        return NextResponse.json({ bloqueos })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al obtener bloqueos" },
            { status: 500 }
        )
    }
}

// POST /api/doctors/[id]/blocks — crear bloqueo
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json(
                { message: "No autenticado" },
                { status: 401 }
            )
        }

        const { id } = await params

        // Verificar que el doctor pertenece al usuario
        const [doctorData] = await db
            .select()
            .from(doctor)
            .where(
                and(
                    eq(doctor.id, id),
                    eq(doctor.usuarioId, session.user.id)
                )
            )
            .limit(1)

        if (!doctorData) {
            return NextResponse.json(
                { message: "No autorizado" },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { fechaInicio, fechaFin, motivo } = body

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json(
                { message: "Fecha inicio y fecha fin son requeridos" },
                { status: 400 }
            )
        }

        if (new Date(fechaInicio) >= new Date(fechaFin)) {
            return NextResponse.json(
                { message: "La fecha de inicio debe ser anterior a la fecha de fin" },
                { status: 400 }
            )
        }

        const [nuevoBloqueo] = await db
            .insert(bloqueoHorario)
            .values({
                doctorId: id,
                fechaInicio: new Date(fechaInicio),
                fechaFin: new Date(fechaFin),
                motivo: motivo ?? null,
            })
            .returning()

        return NextResponse.json(
            { bloqueo: nuevoBloqueo },
            { status: 201 }
        )
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al crear bloqueo" },
            { status: 500 }
        )
    }
}