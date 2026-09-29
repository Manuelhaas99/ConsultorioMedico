import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { doctor, usuario, especialidad, ubicacion, disponibilidadDoctor, tipoConsulta } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// GET /api/doctors/[id] — perfil completo del doctor
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const [doctorData] = await db
            .select({
                id: doctor.id,
                bio: doctor.bio,
                cedula: doctor.cedula,
                aprobado: doctor.aprobado,
                especialidadId: doctor.especialidadId,
                especialidadNombre: especialidad.nombre,
                nombre: usuario.name,
                email: usuario.email,
                imagen: usuario.image,
            })
            .from(doctor)
            .innerJoin(usuario, eq(doctor.usuarioId, usuario.id))
            .innerJoin(especialidad, eq(doctor.especialidadId, especialidad.id))
            .where(eq(doctor.id, id))
            .limit(1)

        if (!doctorData) {
            return NextResponse.json(
                { message: "Doctor no encontrado" },
                { status: 404 }
            )
        }

        // Obtener ubicaciones del doctor
        const ubicaciones = await db
            .select()
            .from(ubicacion)
            .where(eq(ubicacion.doctorId, id))

        // Obtener disponibilidad del doctor
        const disponibilidad = await db
            .select()
            .from(disponibilidadDoctor)
            .where(eq(disponibilidadDoctor.doctorId, id))

        // Obtener tipos de consulta
        const tiposConsulta = await db
            .select()
            .from(tipoConsulta)
            .where(eq(tipoConsulta.doctorId, id))

        return NextResponse.json({
            doctor: {
                ...doctorData,
                ubicaciones,
                disponibilidad,
                tiposConsulta,
            },
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al obtener doctor" },
            { status: 500 }
        )
    }
}