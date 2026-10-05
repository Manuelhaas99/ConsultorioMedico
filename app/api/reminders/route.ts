import { NextResponse } from "next/server"
import { errorJson, leerJson } from "@/lib/http"
import { verificarFirmaQstash } from "@/lib/queue/firma"
import { mensajeRecordatorioSchema } from "@/lib/recordatorios/schemas"
import { procesarRecordatorio } from "@/lib/recordatorios/servicio"

// 2xx (enviado u omitido a propósito) evita que QStash reintente; 500 provoca reintento.
export async function POST(request: Request) {
    // Dentro del handler para que las llaves de QStash se lean en ejecución, no en el build.
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
