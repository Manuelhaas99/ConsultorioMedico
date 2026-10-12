import "server-only"
import { Client } from "@upstash/qstash"
import { env } from "@/lib/env"

let instancia: Client | null = null

export function getQstashClient(): Client {
    if (!instancia) {
        const { QSTASH_TOKEN, QSTASH_URL } = env("qstashPublicacion")
        instancia = new Client({ token: QSTASH_TOKEN, baseUrl: QSTASH_URL })
    }
    return instancia
}
