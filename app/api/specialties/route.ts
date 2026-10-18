import { NextResponse } from "next/server"
import { listarEspecialidades } from "@/lib/especialidades/servicio"
import { errorJson } from "@/lib/http"

export async function GET() {
    try {
        return NextResponse.json({ especialidades: await listarEspecialidades() })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener especialidades")
    }
}
