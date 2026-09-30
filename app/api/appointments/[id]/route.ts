import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { cita } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"

// GET /api/appointments/[id] — obtener cita
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const token = searchParams.get("token")

        const session = await getSession()

        // Debe tener sesión o token de gestión
        if (!session && !token) {
            return NextResponse.json(
                { message: "No autenticado" },
                { status: 401 }
            )
        }

        const [citaData] = await db
            .select()
            .from(cita)
            .where(eq(cita.id, id))
            .limit(1)

        if (!citaData) {
            return NextResponse.json(
                { message: "Cita no encontrada" },
                { status: 404 }
            )
        }

        // Verificar acceso — sesión propia o token válido
        const tieneAcceso =
            (session && citaData.pacienteId === session.user.id) ||
            (token && citaData.tokenGestion === token)

        if (!tieneAcceso) {
            return NextResponse.json(
                { message: "No autorizado" },
                { status: 403 }
            )
        }

        return NextResponse.json({ cita: citaData })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al obtener cita" },
            { status: 500 }
        )
    }
}

// PATCH /api/appointments/[id] — editar o cancelar cita
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const token = searchParams.get("token")
        const session = await getSession()

        if (!session && !token) {
            return NextResponse.json(
                { message: "No autenticado" },
                { status: 401 }
            )
        }

        const [citaData] = await db
            .select()
            .from(cita)
            .where(eq(cita.id, id))
            .limit(1)

        if (!citaData) {
            return NextResponse.json(
                { message: "Cita no encontrada" },
                { status: 404 }
            )
        }

        // Verificar acceso
        const tieneAcceso =
            (session && citaData.pacienteId === session.user.id) ||
            (token && citaData.tokenGestion === token)

        if (!tieneAcceso) {
            return NextResponse.json(
                { message: "No autorizado" },
                { status: 403 }
            )
        }

        // No se puede modificar una cita cancelada o completada
        if (citaData.estado === "cancelada" || citaData.estado === "completada") {
            return NextResponse.json(
                { message: `No se puede modificar una cita ${citaData.estado}` },
                { status: 400 }
            )
        }

        const body = await request.json()
        const { estado, motivoConsulta, notas } = body

        const [citaActualizada] = await db
            .update(cita)
            .set({
                ...(estado && { estado }),
                ...(motivoConsulta && { motivoConsulta }),
                ...(notas && { notas }),
                actualizadoEn: new Date(),
            })
            .where(eq(cita.id, id))
            .returning()

        return NextResponse.json({ cita: citaActualizada })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al actualizar cita" },
            { status: 500 }
        )
    }
}

// DELETE /api/appointments/[id] — cancelar cita
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const token = searchParams.get("token")
        const session = await getSession()

        if (!session && !token) {
            return NextResponse.json(
                { message: "No autenticado" },
                { status: 401 }
            )
        }

        const [citaData] = await db
            .select()
            .from(cita)
            .where(eq(cita.id, id))
            .limit(1)

        if (!citaData) {
            return NextResponse.json(
                { message: "Cita no encontrada" },
                { status: 404 }
            )
        }

        // Verificar acceso
        const tieneAcceso =
            (session && citaData.pacienteId === session.user.id) ||
            (token && citaData.tokenGestion === token)

        if (!tieneAcceso) {
            return NextResponse.json(
                { message: "No autorizado" },
                { status: 403 }
            )
        }

        if (citaData.estado === "cancelada") {
            return NextResponse.json(
                { message: "La cita ya está cancelada" },
                { status: 400 }
            )
        }

        const [citaCancelada] = await db
            .update(cita)
            .set({
                estado: "cancelada",
                actualizadoEn: new Date(),
            })
            .where(eq(cita.id, id))
            .returning()

        return NextResponse.json({
            message: "Cita cancelada correctamente",
            cita: citaCancelada,
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al cancelar cita" },
            { status: 500 }
        )
    }
}