import "server-only"
import { env } from "@/lib/env"
import { claveRecordatorio, recordatoriosPorProgramar } from "@/lib/recordatorios/reglas"
import { getQstashClient } from "./client"

/**
 * El mensaje lleva el horario de la cita para que el handler omita los de citas
 * canceladas o reprogramadas sin cancelar mensajes en QStash. Al reprogramar, basta con volver a llamarla.
 */
export async function programarRecordatorios({ citaId, fechaInicio }: { citaId: string; fechaInicio: Date }) {
    const qstash = getQstashClient()
    const url = new URL("/api/reminders", env("app").BETTER_AUTH_URL).toString()

    await Promise.all(
        recordatoriosPorProgramar(citaId, fechaInicio).map(({ tipo, enviarEn, cuerpo }) =>
            qstash.publishJSON({
                url,
                notBefore: Math.floor(enviarEn.getTime() / 1000),
                deduplicationId: claveRecordatorio({ citaId, tipo, fechaInicio }),
                body: cuerpo,
            }),
        ),
    )
}
