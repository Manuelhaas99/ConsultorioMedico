import { NextRequest, NextResponse } from "next/server"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { db } from "@/lib/db/client"
import { cita, doctor, usuario, especialidad } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { enviarRecordatorioCita } from "@/lib/email/send"

async function handler(request: NextRequest) {
    try {
        const body = await request.json()
        const { citaId, tipo, emailPaciente } = body

        // Obtener datos de la cita
        const [citaData] = await db
            .select({
                id: cita.id,
                fechaInicio: cita.fechaInicio,
                fechaFin: cita.fechaFin,
                estado: cita.estado,
                invitadoNombre: cita.invitadoNombre,
                invitadoEmail: cita.invitadoEmail,
                pacienteId: cita.pacienteId,
                doctorNombre: usuario.name,
                especialidadNombre: especialidad.nombre,
                recordatorio24h: cita.recordatorio24hEnviado,
                recordatorio1h: cita.recordatorio1hEnviado,
            })
            .from(cita)
            .innerJoin(doctor, eq(cita.doctorId, doctor.id))
            .innerJoin(usuario, eq(doctor.usuarioId, usuario.id))
            .innerJoin(especialidad, eq(doctor.especialidadId, especialidad.id))
            .where(eq(cita.id, citaId))
            .limit(1)

        if (!citaData) {
            return NextResponse.json({ message: "Cita no encontrada" }, { status: 404 })
        }

        // No enviar si la cita fue cancelada
        if (citaData.estado === "cancelada") {
            return NextResponse.json({ message: "Cita cancelada, recordatorio omitido" })
        }

        // Verificar idempotencia — no enviar dos veces
        if (tipo === "24h" && citaData.recordatorio24h) {
            return NextResponse.json({ message: "Recordatorio 24h ya enviado" })
        }
        if (tipo === "1h" && citaData.recordatorio1h) {
            return NextResponse.json({ message: "Recordatorio 1h ya enviado" })
        }

        // Obtener nombre del paciente
        let nombrePaciente = citaData.invitadoNombre ?? "Paciente"
        if (citaData.pacienteId) {
            const [paciente] = await db
                .select({ name: usuario.name })
                .from(usuario)
                .where(eq(usuario.id, citaData.pacienteId))
                .limit(1)
            if (paciente) nombrePaciente = paciente.name
        }

        // Enviar recordatorio
        await enviarRecordatorioCita({
            email: emailPaciente,
            nombrePaciente,
            nombreDoctor: citaData.doctorNombre,
            especialidad: citaData.especialidadNombre,
            fechaInicio: citaData.fechaInicio,
            fechaFin: citaData.fechaFin,
            invitado: citaData.pacienteId === null,
            tiempoRestante: tipo,
            citaId,
        })

        // Marcar como enviado
        await db
            .update(cita)
            .set({
                ...(tipo === "24h" && { recordatorio24hEnviado: true }),
                ...(tipo === "1h" && { recordatorio1hEnviado: true }),
            })
            .where(eq(cita.id, citaId))

        return NextResponse.json({ message: `Recordatorio ${tipo} enviado correctamente` })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: "Error enviando recordatorio" },
            { status: 500 }
        )
    }
}

export const POST = verifySignatureAppRouter(handler)