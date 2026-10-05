import { NextRequest, NextResponse } from "next/server"
import { citaParaPaciente } from "@/lib/citas/dto"
import { actualizarCitaSchema } from "@/lib/citas/schemas"
import { actualizarCita, cancelarCita, obtenerCita, type AccesoCita } from "@/lib/citas/servicio"
import { tokenGestionSchema } from "@/lib/citas/token"
import { errorJson, leerCuerpo, tokenBearer } from "@/lib/http"
import { RESPUESTAS_ERROR_ACTUALIZAR } from "../respuestas"

// Gestión de la cita de un invitado con su token de gestión.
// El token viaja en `Authorization: Bearer <token>`, nunca en la URL (quedaría en
// logs y en Referer). El correo enlaza a /cita#token=...: la página lee el
// fragmento en el cliente y llama a esta API con la cabecera.
// Con el token se tiene el rol "paciente" de la política (lib/citas/politica.ts):
// ver, cancelar y editar el motivo de una cita futura pendiente o confirmada.

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

// GET /api/appointments/gestion — ver la cita
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

// PATCH /api/appointments/gestion — cancelar o editar el motivo de consulta
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

// DELETE /api/appointments/gestion — cancelar la cita
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
