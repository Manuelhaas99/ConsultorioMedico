import "server-only"
import { enviarConfirmacionCita } from "@/lib/email/send"
import { programarRecordatorios } from "@/lib/queue/reminders"
import { datosConfirmacion, type CitaCreada } from "./confirmacion"

/** Un fallo de correo o de QStash no deshace la cita: se registra y se continúa. */
export async function notificarCitaCreada(creada: CitaCreada & { cita: { id: string } }): Promise<void> {
    const datos = datosConfirmacion(creada)
    if (!datos) return

    const [correo, recordatorios] = await Promise.allSettled([
        enviarConfirmacionCita(datos),
        programarRecordatorios({ citaId: creada.cita.id, fechaInicio: creada.cita.fechaInicio }),
    ])
    if (correo.status === "rejected") console.error("Error enviando la confirmación de la cita", correo.reason)
    if (recordatorios.status === "rejected") console.error("Error programando recordatorios", recordatorios.reason)
}
