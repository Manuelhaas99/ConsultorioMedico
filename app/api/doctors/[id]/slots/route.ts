import { NextRequest, NextResponse } from "next/server"
import { errorJson, leerQuery } from "@/lib/http"
import { doctorIdSchema, slotsQuerySchema } from "@/lib/citas/schemas"
import { obtenerSlots } from "@/lib/citas/servicio"

// GET /api/doctors/[id]/slots?fecha=2026-09-29&duracion=30
export async function GET(request: NextRequest, ctx: RouteContext<"/api/doctors/[id]/slots">) {
    const idParseado = doctorIdSchema.safeParse((await ctx.params).id)
    if (!idParseado.success) {
        return errorJson(400, "Datos inválidos", { id: idParseado.error.issues.map((i) => i.message) })
    }

    const query = leerQuery(request, slotsQuerySchema)
    if (!query.ok) return query.response

    try {
        const slots = await obtenerSlots(idParseado.data, query.data)
        return NextResponse.json({ slots })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener slots")
    }
}
