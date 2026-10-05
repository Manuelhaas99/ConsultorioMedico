import "server-only"
import { env } from "@/lib/env"
import { claveRecordatorio, recordatoriosPorProgramar } from "@/lib/recordatorios/reglas"
import { getQstashClient } from "./client"

/**
 * Programa en QStash los recordatorios de 24 h y 1 h que aún queden en el futuro.
 * El mensaje lleva el horario de la cita: si se reprograma o cancela, el handler
 * lo detecta al entregarse y lo omite (no hace falta cancelar mensajes en QStash).
 * Al reprogramar una cita basta con volver a llamar a esta función.
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
