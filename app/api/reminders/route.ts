import { NextResponse } from "next/server"
import { errorJson, leerJson } from "@/lib/http"
import { verificarFirmaQstash } from "@/lib/queue/firma"
import { mensajeRecordatorioSchema } from "@/lib/recordatorios/schemas"
import { procesarRecordatorio } from "@/lib/recordatorios/servicio"

// POST /api/reminders — webhook de QStash que envía un recordatorio de cita.
// Responde 2xx cuando el recordatorio se envió o se omitió a propósito (QStash no
// reintenta) y 500 ante un error inesperado (QStash reintenta).
export async function POST(request: Request) {
    // La firma se verifica dentro del handler (y no con un wrapper al importar)
    // para que las llaves de QStash se lean en tiempo de ejecución, no en el build.
    const firma = await verificarFirmaQstash(request)
    if (!firma.ok) return errorJson(403, "Firma inválida")

    const mensaje = leerJson(firma.cuerpo, mensajeRecordatorioSchema)
    if (!mensaje.ok) return mensaje.response

    try {
        const resultado = await procesarRecordatorio(mensaje.data)
        if (!resultado.enviado) {
            return NextResponse.json({ message: "Recordatorio omitido", motivo: resultado.motivo })
        }
        return NextResponse.json({ message: `Recordatorio ${mensaje.data.tipo} enviado` })
    } catch (error) {
        console.error("Error enviando recordatorio", error)
        return errorJson(500, "Error enviando recordatorio")
    }
}
