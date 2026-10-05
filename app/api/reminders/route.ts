import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { cita, doctor, usuario, especialidad } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { enviarRecordatorioCita } from "@/lib/email/send"
import { verificarFirmaQstash } from "@/lib/queue/firma"

export async function POST(request: NextRequest) {
    // La firma se verifica dentro del handler (y no con un wrapper al importar)
    // para que las llaves de QStash se lean en tiempo de ejecución, no en el build.
    const firma = await verificarFirmaQstash(request)
    if (!firma.ok) {
        return NextResponse.json({ message: "Firma inválida" }, { status: 403 })
    }

    try {
        const body = JSON.parse(firma.cuerpo)
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
