import { NextRequest, NextResponse } from "next/server"
import { citaParaPaciente } from "@/lib/citas/dto"
import { actualizarCitaSchema } from "@/lib/citas/schemas"
import { actualizarCita, cancelarCita, obtenerCita, type AccesoCita } from "@/lib/citas/servicio"
import { tokenGestionSchema } from "@/lib/citas/token"
import { errorJson, leerCuerpo, tokenBearer } from "@/lib/http"
import { RESPUESTAS_ERROR_ACTUALIZAR } from "../respuestas"

// El token viaja en `Authorization`, nunca en la URL, donde quedaría en logs y en Referer.

type Entrada = { ok: true; acceso: AccesoCita } | { ok: false; response: NextResponse }

function leerToken(request: NextRequest): Entrada {
    const token = tokenGestionSchema.safeParse(tokenBearer(request) ?? undefined)
    if (!token.success) {
        const response = errorJson(401, "Token de gestión ausente o inválido")
        response.headers.set("WWW-Authenticate", 'Bearer realm="gestion-cita"')
        return { ok: false, response }
    }
    return { ok: true, acceso: { token: token.data } }
}

export async function GET(request: NextRequest) {
    try {
        const entrada = leerToken(request)
        if (!entrada.ok) return entrada.response

        const resultado = await obtenerCita(entrada.acceso)
        if (!resultado.ok) return errorJson(404, "Cita no encontrada")
        return NextResponse.json({ cita: citaParaPaciente(resultado.cita) })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener cita")
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const entrada = leerToken(request)
        if (!entrada.ok) return entrada.response

        const cuerpo = await leerCuerpo(request, actualizarCitaSchema)
        if (!cuerpo.ok) return cuerpo.response

        const resultado = await actualizarCita(entrada.acceso, cuerpo.data)
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR_ACTUALIZAR[resultado.error]
            return errorJson(status, message)
        }
        return NextResponse.json({ cita: citaParaPaciente(resultado.cita) })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al actualizar cita")
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const entrada = leerToken(request)
        if (!entrada.ok) return entrada.response

        const resultado = await cancelarCita(entrada.acceso)
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR_ACTUALIZAR[resultado.error]
            return errorJson(status, message)
        }
        return NextResponse.json({ message: "Cita cancelada correctamente", cita: citaParaPaciente(resultado.cita) })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al cancelar cita")
    }
}
