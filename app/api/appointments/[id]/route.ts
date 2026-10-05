import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { citaParaRol } from "@/lib/citas/dto"
import { actualizarCitaSchema, citaIdSchema } from "@/lib/citas/schemas"
import { actualizarCita, cancelarCita, obtenerCita, type AccesoCita } from "@/lib/citas/servicio"
import { errorJson, leerCuerpo } from "@/lib/http"
import { RESPUESTAS_ERROR_ACTUALIZAR } from "../respuestas"

// Gestión de una cita por id con sesión (paciente, doctor dueño o secretario).
// Los invitados usan /api/appointments/gestion con su token en Authorization.

type Contexto = RouteContext<"/api/appointments/[id]">

type Entrada = { ok: true; acceso: AccesoCita } | { ok: false; response: NextResponse }

/** Valida el id y exige sesión. */
async function leerEntrada(ctx: Contexto): Promise<Entrada> {
    const id = citaIdSchema.safeParse((await ctx.params).id)
    if (!id.success) {
        return { ok: false, response: errorJson(400, "Datos inválidos", { id: id.error.issues.map((i) => i.message) }) }
    }
    const session = await getSession()
    if (!session) return { ok: false, response: errorJson(401, "No autenticado") }
    return { ok: true, acceso: { citaId: id.data, usuarioId: session.user.id } }
}

// GET /api/appointments/[id] — obtener cita
export async function GET(_request: NextRequest, ctx: Contexto) {
    try {
        const entrada = await leerEntrada(ctx)
        if (!entrada.ok) return entrada.response

        const resultado = await obtenerCita(entrada.acceso)
        if (!resultado.ok) return errorJson(404, "Cita no encontrada")
        return NextResponse.json({ cita: citaParaRol(resultado.cita, resultado.rol) })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener cita")
    }
}

// PATCH /api/appointments/[id] — el paciente cancela o edita el motivo; el personal cambia estado y notas
export async function PATCH(request: NextRequest, ctx: Contexto) {
    try {
        const entrada = await leerEntrada(ctx)
        if (!entrada.ok) return entrada.response

        const cuerpo = await leerCuerpo(request, actualizarCitaSchema)
        if (!cuerpo.ok) return cuerpo.response

        const resultado = await actualizarCita(entrada.acceso, cuerpo.data)
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR_ACTUALIZAR[resultado.error]
            return errorJson(status, message)
        }
        return NextResponse.json({ cita: citaParaRol(resultado.cita, resultado.rol) })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al actualizar cita")
    }
}

// DELETE /api/appointments/[id] — cancelar cita
export async function DELETE(_request: NextRequest, ctx: Contexto) {
    try {
        const entrada = await leerEntrada(ctx)
        if (!entrada.ok) return entrada.response

        const resultado = await cancelarCita(entrada.acceso)
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR_ACTUALIZAR[resultado.error]
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
