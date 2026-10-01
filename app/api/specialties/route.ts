import { NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { especialidad } from "@/lib/db/schema"

// GET /api/specialties — listar especialidades
export async function GET() {
    try {
        const especialidades = await db
            .select()
            .from(especialidad)
            .orderBy(especialidad.nombre)

        return NextResponse.json({ especialidades })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al obtener especialidades" },
            { status: 500 }
        )
    }
}