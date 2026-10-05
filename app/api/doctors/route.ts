import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db/client"
import {doctor, usuario, especialidad, ubicacion} from "@/lib/db/schema"
import {eq} from "drizzle-orm"
import {getSession} from "@/lib/auth/session";
import {registrarDoctorSchema} from "@/lib/doctores/schemas"
import {registrarDoctor, type ErrorRegistrarDoctor} from "@/lib/doctores/servicio"
import {errorJson, leerCuerpo} from "@/lib/http"

export async function GET(request: NextRequest) {
    try {
        const {searchParams} = new URL(request.url)
        const especialidadId = searchParams.get("especialidad")
        const ciudad = searchParams.get("ciudad")

        const doctores = await db
            .select({
                id: doctor.id,
                bio: doctor.bio,
                cedula: doctor.cedula,
                especialidadId: doctor.especialidadId,
                especialidadNombre: especialidad.nombre,
                nombre: usuario.name,
                email: usuario.email,
                imagen: usuario.image,
            })
            .from(doctor)
            .innerJoin(usuario, eq(doctor.usuarioId, usuario.id))
            .innerJoin(especialidad, eq(doctor.especialidadId, especialidad.id))
            .where(eq(doctor.aprobado, true))

        return NextResponse.json({doctores})
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            {message: "Error al obtener doctores"},
            {status: 500}
        )
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
