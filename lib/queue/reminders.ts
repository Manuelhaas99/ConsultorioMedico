import { getQstashClient } from "./client"

export async function programarRecordatorios({
                                                 citaId,
                                                 fechaInicio,
                                                 emailPaciente,
                                             }: {
    citaId: string
    fechaInicio: Date
    emailPaciente: string
}) {
    const qstash = getQstashClient()
    const baseUrl = process.env.BETTER_AUTH_URL!

    console.log("QSTASH TOKEN:", process.env.QSTASH_TOKEN ? "existe" : "VACIO")
    console.log("QSTASH URL:", process.env.QSTASH_URL)
    console.log("BASE URL:", baseUrl)

    // Recordatorio 24h antes
    const fecha24h = new Date(fechaInicio.getTime() - 24 * 60 * 60 * 1000)
    const ahora = new Date()

    if (fecha24h > ahora) {
        console.log("Programando recordatorio 24h para:", fecha24h.toISOString())
        const result = await qstash.publishJSON({
            url: `${baseUrl}/api/reminders`,
            notBefore: Math.floor(fecha24h.getTime() / 1000),
            body: {
                citaId,
                tipo: "24h",
                emailPaciente,
            },
        })
        console.log("Resultado 24h:", result)
    }

    // Recordatorio 1h antes
    const fecha1h = new Date(fechaInicio.getTime() - 60 * 60 * 1000)

    if (fecha1h > ahora) {
        await qstash.publishJSON({
            url: `${baseUrl}/api/reminders`,
            notBefore: Math.floor(fecha1h.getTime() / 1000),
            body: {
                citaId,
                tipo: "1h",
                emailPaciente,
            },
        })
    }
}