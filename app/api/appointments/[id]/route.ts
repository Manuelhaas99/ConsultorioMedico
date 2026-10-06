import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { citaParaRol } from "@/lib/citas/dto"
import { actualizarCitaSchema, citaIdSchema } from "@/lib/citas/schemas"
import {
    actualizarCita,
    cancelarCita,
    obtenerCita,
    type ErrorActualizarCita,
    type IdentidadCita,
} from "@/lib/citas/servicio"
import { errorJson, leerCuerpo } from "@/lib/http"

type Contexto = RouteContext<"/api/appointments/[id]">

const RESPUESTAS_ERROR = {
    NO_ENCONTRADA: [404, "Cita no encontrada"],
    CAMBIO_NO_PERMITIDO: [403, "No tienes permiso para hacer ese cambio en la cita"],
    CITA_NO_EDITABLE: [409, "La cita ya no se puede modificar"],
    TRANSICION_INVALIDA: [409, "La cita no puede pasar a ese estado desde su estado actual"],
    CONFLICTO: [409, "La cita cambió mientras se procesaba la solicitud; vuelve a intentarlo"],
} as const satisfies Record<ErrorActualizarCita, readonly [number, string]>

type Entrada = { ok: true; id: string; identidad: IdentidadCita } | { ok: false; response: NextResponse }

async function leerEntrada(request: NextRequest, ctx: Contexto): Promise<Entrada> {
    const id = citaIdSchema.safeParse((await ctx.params).id)
    if (!id.success) {
        return { ok: false, response: errorJson(400, "Datos inválidos", { id: id.error.issues.map((i) => i.message) }) }
    }
    const token = request.nextUrl.searchParams.get("token") || null
    const session = await getSession()
    if (!session && !token) return { ok: false, response: errorJson(401, "No autenticado") }
    return { ok: true, id: id.data, identidad: { usuarioId: session?.user.id ?? null, token } }
}

export async function GET(request: NextRequest, ctx: Contexto) {
    try {
        const entrada = await leerEntrada(request, ctx)
        if (!entrada.ok) return entrada.response

        const resultado = await obtenerCita(entrada.id, entrada.identidad)
        if (!resultado.ok) return errorJson(404, "Cita no encontrada")
        return NextResponse.json({ cita: citaParaRol(resultado.cita, resultado.rol) })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener cita")
    }
}

export async function PATCH(request: NextRequest, ctx: Contexto) {
    try {
        const entrada = await leerEntrada(request, ctx)
        if (!entrada.ok) return entrada.response

        const cuerpo = await leerCuerpo(request, actualizarCitaSchema)
        if (!cuerpo.ok) return cuerpo.response

        const resultado = await actualizarCita(entrada.id, cuerpo.data, entrada.identidad)
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR[resultado.error]
            return errorJson(status, message)
        }
        return NextResponse.json({ cita: citaParaRol(resultado.cita, resultado.rol) })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al actualizar cita")
    }
}

// DELETE /api/appointments/[id] — cancelar cita
export async function DELETE(request: NextRequest, ctx: Contexto) {
    try {
        const entrada = await leerEntrada(request, ctx)
        if (!entrada.ok) return entrada.response

        const resultado = await cancelarCita(entrada.id, entrada.identidad)
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR[resultado.error]
            return errorJson(status, message)
        }
        return NextResponse.json({
            message: "Cita cancelada correctamente",
            cita: citaParaRol(resultado.cita, resultado.rol),
        })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al cancelar cita")
    }
}
