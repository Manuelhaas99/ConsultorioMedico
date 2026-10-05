import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { doctorIdSchema } from "@/lib/doctores/schemas"
import { aprobarDoctor, type ErrorAprobarDoctor } from "@/lib/doctores/servicio"
import { errorJson } from "@/lib/http"

const RESPUESTAS_ERROR_APROBAR = {
    NO_AUTORIZADO: [403, "Solo un administrador puede aprobar doctores"],
    NO_ENCONTRADO: [404, "Doctor no encontrado"],
} as const satisfies Record<ErrorAprobarDoctor, readonly [number, string]>

// PATCH /api/doctors/[id]/aprobacion — (solo admin) aprueba al doctor y asigna rol medico a su usuario
export async function PATCH(_request: NextRequest, ctx: RouteContext<"/api/doctors/[id]/aprobacion">) {
    try {
        const id = doctorIdSchema.safeParse((await ctx.params).id)
        if (!id.success) {
            return errorJson(400, "Datos inválidos", { id: id.error.issues.map((i) => i.message) })
        }

        const session = await getSession()
        if (!session) return errorJson(401, "No autenticado")

        const resultado = await aprobarDoctor(id.data, { usuarioId: session.user.id })
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR_APROBAR[resultado.error]
            return errorJson(status, message)
        }
        return NextResponse.json({ message: "Doctor aprobado", doctor: resultado.doctor })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al aprobar doctor")
    }
}
