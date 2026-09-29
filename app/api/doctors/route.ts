import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db/client"
import {doctor, usuario, especialidad, ubicacion} from "@/lib/db/schema"
import {eq} from "drizzle-orm"
import {getSession} from "@/lib/auth/session";

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

export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json(
                {message: "No autenticado"},
                {status: 401}
            )
        }
        const body = await request.json()
        const {especialidadId, cedula, bio} = body

        if(!especialidadId || !cedula) {
            return NextResponse.json(
                { message: "Especialidad y cédula son requeridos" },
                { status: 400 }
            )
        }

        const existente = await db
            .select()
            .from(doctor)
            .where(eq(doctor.cedula, cedula))
            .limit(1)

        if(existente.length > 0) {
            return NextResponse.json(
                { message: "Ya existe un doctor con esa cédula" },
                { status: 409 }
            )
        }

        const [nuevodoctor] = await db
            .insert(doctor)
            .values({
                usuarioId: session.user.id,
                especialidadId,
                cedula,
                bio: bio ?? null,
                aprobado: false,
            })
            .returning()
        await db
            .update(usuario)
            .set({ rol: "medico" })
            .where(eq(usuario.id, session.user.id))

        return NextResponse.json(
            { message: "Doctor registrado, pendiente de aprobación", doctor: nuevodoctor},
            { status: 201 }
        )
    } catch (error) {
        console.error(error)
        return  NextResponse.json(
            { message: "Error al registrar doctor " },
            { status: 500 }
        )
    }
}