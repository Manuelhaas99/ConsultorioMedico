import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { doctorIdSchema } from "@/lib/doctores/schemas"
import { obtenerPerfilDoctor } from "@/lib/doctores/servicio"
import { errorJson } from "@/lib/http"

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/doctors/[id]">) {
    try {
        const id = doctorIdSchema.safeParse((await ctx.params).id)
        if (!id.success) {
            return errorJson(400, "Datos inválidos", { id: id.error.issues.map((i) => i.message) })
        }

        const session = await getSession()
        const resultado = await obtenerPerfilDoctor(id.data, session ? { usuarioId: session.user.id } : null)
        if (!resultado.ok) return errorJson(404, "Doctor no encontrado")
        return NextResponse.json({ doctor: resultado.data })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener doctor")
    }
}
