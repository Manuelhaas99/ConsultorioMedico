import { Client } from "@upstash/qstash"

let _client: Client | null = null

export function getQstashClient() {
    if (!_client) {
        _client = new Client({
            token: process.env.QSTASH_TOKEN!,
            baseUrl: process.env.QSTASH_URL,
        })
    }
    return _client
}