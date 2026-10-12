import "server-only"
import { Receiver, SignatureError } from "@upstash/qstash"
import { env } from "@/lib/env"

let receptor: Receiver | null = null

function getReceiver(): Receiver {
    if (!receptor) {
        const { QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY } = env("qstashFirma")
        receptor = new Receiver({
            currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
            nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
        })
    }
    return receptor
}

export type ResultadoFirma = { ok: true; cuerpo: string } | { ok: false }

/** Consume el cuerpo de la petición; si la firma es válida lo devuelve como texto. */
export async function verificarFirmaQstash(request: Request): Promise<ResultadoFirma> {
    const firma = request.headers.get("upstash-signature")
    if (!firma) return { ok: false }
    const cuerpo = await request.text()
    try {
        const valida = await getReceiver().verify({
            signature: firma,
            body: cuerpo,
            upstashRegion: request.headers.get("upstash-region") ?? undefined,
        })
        return valida ? { ok: true, cuerpo } : { ok: false }
    } catch (error) {
        if (error instanceof SignatureError) return { ok: false }
        throw error
    }
}
