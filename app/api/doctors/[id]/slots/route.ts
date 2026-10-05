import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { disponibilidadDoctor, bloqueoHorario, cita } from "@/lib/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"
import { errorJson, leerQuery } from "@/lib/http"
import { doctorIdSchema, slotsQuerySchema } from "@/lib/citas/schemas"
import { diaSemanaDeFecha, generarSlots } from "@/lib/citas/slots"

// GET /api/doctors/[id]/slots?fecha=2026-09-29&duracion=30
export async function GET(request: NextRequest, ctx: RouteContext<"/api/doctors/[id]/slots">) {
    const idParseado = doctorIdSchema.safeParse((await ctx.params).id)
    if (!idParseado.success) {
        return errorJson(400, "Datos inválidos", { id: idParseado.error.issues.map((i) => i.message) })
    }
    const id = idParseado.data

    const query = leerQuery(request, slotsQuerySchema)
    if (!query.ok) return query.response
    const { fecha, duracion } = query.data

    try {
        const diaSemana = diaSemanaDeFecha(fecha)
        if (!diaSemana) return NextResponse.json({ slots: [] })

        // 1 — Obtener disponibilidad del doctor para ese día
        const disponibilidad = await db
            .select()
            .from(disponibilidadDoctor)
            .where(
                and(
                    eq(disponibilidadDoctor.doctorId, id),
                    eq(disponibilidadDoctor.diaSemana, diaSemana)
                )
            )

        if (disponibilidad.length === 0) {
            return NextResponse.json({ slots: [] })
        }

        // 2 — Obtener bloqueos que afectan ese día
        const inicioDia = new Date(fecha + "T00:00:00.000Z")
        const finDia = new Date(fecha + "T23:59:59.999Z")

        const bloqueos = await db
            .select()
            .from(bloqueoHorario)
            .where(
                and(
                    eq(bloqueoHorario.doctorId, id),
                    lte(bloqueoHorario.fechaInicio, finDia),
                    gte(bloqueoHorario.fechaFin, inicioDia)
                )
            )

        // 3 — Obtener citas existentes ese día
        const citasExistentes = await db
            .select({
                fechaInicio: cita.fechaInicio,
                fechaFin: cita.fechaFin,
            })
            .from(cita)
            .where(
                and(
                    eq(cita.doctorId, id),
                    gte(cita.fechaInicio, inicioDia),
                    lte(cita.fechaFin, finDia),
                    eq(cita.estado, "cancelada")
                )
            )

        // 4 — Generar slots
        const slots = generarSlots({
            fecha,
            duracionMinutos: duracion,
            franjas: disponibilidad,
            ocupados: [...bloqueos, ...citasExistentes].map((o) => ({ inicio: o.fechaInicio, fin: o.fechaFin })),
        })

        return NextResponse.json({ slots })
    } catch (error) {
        console.error(error)
        return errorJson(500, "Error al obtener slots")
    }
}
