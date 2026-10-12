import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/auth/session";
import {listarDoctoresQuerySchema, registrarDoctorSchema} from "@/lib/doctores/schemas"
import {listarDoctores, registrarDoctor, type ErrorRegistrarDoctor} from "@/lib/doctores/servicio"
import {errorJson, leerCuerpo, leerQuery} from "@/lib/http"

export async function GET(request: NextRequest) {
    const query = leerQuery(request, listarDoctoresQuerySchema)
    if (!query.ok) return query.response

    try {
        const doctores = await listarDoctores(query.data)
        return NextResponse.json({doctores})
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener doctores")
    }
}

const RESPUESTAS_ERROR_REGISTRO = {
    ROL_NO_PERMITIDO: [403, "Solo un paciente puede solicitar registrarse como doctor"],
    PERFIL_DUPLICADO: [409, "Ya tienes un perfil de doctor registrado"],
    CEDULA_DUPLICADA: [409, "Ya existe un doctor con esa cédula"],
    ESPECIALIDAD_INVALIDA: [400, "La especialidad no existe"],
} as const satisfies Record<ErrorRegistrarDoctor, readonly [number, string]>

export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session) return errorJson(401, "No autenticado")

        const cuerpo = await leerCuerpo(request, registrarDoctorSchema)
        if (!cuerpo.ok) return cuerpo.response

        const resultado = await registrarDoctor(cuerpo.data, { usuarioId: session.user.id })
        if (!resultado.ok) {
            const [status, message] = RESPUESTAS_ERROR_REGISTRO[resultado.error]
            return errorJson(status, message)
        }
        return NextResponse.json(
            { message: "Doctor registrado, pendiente de aprobación", doctor: resultado.doctor },
            { status: 201 }
        )
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al registrar doctor")
    }
}
