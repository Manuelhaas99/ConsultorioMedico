import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { crearBloqueoSchema, doctorIdSchema } from "@/lib/doctores/schemas"
import { crearBloqueo, obtenerBloqueos, type ErrorGestionarAgenda } from "@/lib/doctores/servicio"
import { errorJson, leerCuerpo } from "@/lib/http"

const RESPUESTAS_ERROR_CREAR = {
    NO_ENCONTRADO: [404, "Doctor no encontrado"],
    NO_AUTORIZADO: [403, "No tienes permiso para gestionar la agenda de este doctor"],
} as const satisfies Record<ErrorGestionarAgenda, readonly [number, string]>

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/doctors/[id]/blocks">) {
    try {
        const id = doctorIdSchema.safeParse((await ctx.params).id)
        if (!id.success) {
            return errorJson(400, "Datos inválidos", { id: id.error.issues.map((i) => i.message) })
        }

        const session = await getSession()
        const resultado = await obtenerBloqueos(id.data, session ? { usuarioId: session.user.id } : null)
        if (!resultado.ok) return errorJson(404, "Doctor no encontrado")
        return NextResponse.json({ bloqueos: resultado.data })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener bloqueos")
    }
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/doctors/[id]/blocks">) {
    const id = doctorIdSchema.safeParse((await ctx.params).id)
    if (!id.success) {
        return errorJson(400, "Datos inválidos", { id: id.error.issues.map((i) => i.message) })
    }
    const cuerpo = await leerCuerpo(request, crearBloqueoSchema)
    if (!cuerpo.ok) return cuerpo.response

    try {
        const session = await getSession()
        if (!session) return errorJson(401, "No autenticado")

        const resultado = await crearBloqueo(id.data, cuerpo.data, { usuarioId: session.user.id })
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR_CREAR[resultado.error]
            return errorJson(status, message)
        }
        return NextResponse.json({ bloqueo: resultado.bloqueo }, { status: 201 })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al crear bloqueo")
    }
}
