import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { disponibilidadDoctor, doctor } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"
import { doctorIdSchema } from "@/lib/doctores/schemas"
import { obtenerDisponibilidad } from "@/lib/doctores/servicio"
import { errorJson } from "@/lib/http"

// GET /api/doctors/[id]/availability — horario semanal del doctor (404 si no está aprobado y no es tuyo)
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/doctors/[id]/availability">) {
    try {
        const id = doctorIdSchema.safeParse((await ctx.params).id)
        if (!id.success) {
            return errorJson(400, "Datos inválidos", { id: id.error.issues.map((i) => i.message) })
        }

        const session = await getSession()
        const resultado = await obtenerDisponibilidad(id.data, session ? { usuarioId: session.user.id } : null)
        if (!resultado.ok) return errorJson(404, "Doctor no encontrado")
        return NextResponse.json({ disponibilidad: resultado.data })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener disponibilidad")
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