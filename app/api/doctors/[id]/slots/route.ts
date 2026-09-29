import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { disponibilidadDoctor, bloqueoHorario, cita } from "@/lib/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"

const DIAS_SEMANA = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
] as const

// GET /api/doctors/[id]/slots?fecha=2026-09-29&duracion=30
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const fecha = searchParams.get("fecha")
        const duracion = parseInt(searchParams.get("duracion") ?? "30")

        if (!fecha) {
            return NextResponse.json(
                { message: "El parámetro fecha es requerido (YYYY-MM-DD)" },
                { status: 400 }
            )
        }

        const fechaDate = new Date(fecha)
        const diaSemana = DIAS_SEMANA[fechaDate.getDay()]

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
        const slots: { inicio: string; fin: string; disponible: boolean }[] = []

        for (const disp of disponibilidad) {
            const [horaInicioH, horaInicioM] = disp.horaInicio.split(":").map(Number)
            const [horaFinH, horaFinM] = disp.horaFin.split(":").map(Number)

            let slotInicio = new Date(fecha)
            slotInicio.setHours(horaInicioH, horaInicioM, 0, 0)

            const slotFinLimite = new Date(fecha)
            slotFinLimite.setHours(horaFinH, horaFinM, 0, 0)

            while (slotInicio < slotFinLimite) {
                const slotFin = new Date(slotInicio.getTime() + duracion * 60 * 1000)

                if (slotFin > slotFinLimite) break

                // Verificar si el slot está bloqueado
                const bloqueado = bloqueos.some(
                    (b) => slotInicio < b.fechaFin && slotFin > b.fechaInicio
                )

                // Verificar si el slot tiene una cita
                const ocupado = citasExistentes.some(
                    (c) => slotInicio < c.fechaFin && slotFin > c.fechaInicio
                )

                slots.push({
                    inicio: slotInicio.toISOString(),
                    fin: slotFin.toISOString(),
                    disponible: !bloqueado && !ocupado,
                })

                slotInicio = slotFin
            }
        }

        return NextResponse.json({ slots })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error al obtener slots" },
            { status: 500 }
        )
    }
}