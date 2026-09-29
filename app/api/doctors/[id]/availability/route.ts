import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { disponibilidadDoctor, doctor } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"

// GET /api/doctors/[id]/availability — obtener disponibilidad
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const disponibilidad = await db
            .select()
            .from(disponibilidadDoctor)
            .where(eq(disponibilidadDoctor.doctorId, id))

        return NextResponse.json({ disponibilidad })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al obtener disponibilidad" },
            { status: 500 }
        )
    }
}

// POST /api/doctors/[id]/availability — configurar disponibilidad
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
        const { diaSemana, horaInicio, horaFin, ubicacionId } = body

        if (!diaSemana || !horaInicio || !horaFin) {
            return NextResponse.json(
                { message: "Día, hora inicio y hora fin son requeridos" },
                { status: 400 }
            )
        }

        const [nuevaDisponibilidad] = await db
            .insert(disponibilidadDoctor)
            .values({
                doctorId: id,
                diaSemana,
                horaInicio,
                horaFin,
                ubicacionId: ubicacionId ?? null,
            })
            .returning()

        return NextResponse.json(
            { disponibilidad: nuevaDisponibilidad },
            { status: 201 }
        )
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al configurar disponibilidad" },
            { status: 500 }
        )
    }
}