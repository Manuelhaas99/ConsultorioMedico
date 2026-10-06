import { createHash, createHmac } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const LLAVE_ACTUAL = "llave-actual-de-prueba"
const LLAVE_SIGUIENTE = "llave-siguiente-de-prueba"

const base64url = (datos: Buffer | string) => Buffer.from(datos).toString("base64url")

/** Firma como lo hace QStash: JWT HS256 con el hash SHA-256 del cuerpo. */
function firmar(cuerpo: string, llave: string, { expirado = false } = {}): string {
    const ahora = Math.floor(Date.now() / 1000)
    const encabezado = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    const carga = base64url(
        JSON.stringify({
            iss: "Upstash",
            sub: "https://citas.example.com/api/reminders",
            iat: ahora - 10,
            nbf: ahora - 10,
            exp: expirado ? ahora - 5 : ahora + 300,
            jti: "msg_1",
            body: base64url(createHash("sha256").update(cuerpo).digest()),
        }),
    )
    const firma = base64url(createHmac("sha256", llave).update(`${encabezado}.${carga}`).digest())
    return `${encabezado}.${carga}.${firma}`
}

function peticion(cuerpo: string, firma?: string) {
    return new Request("https://citas.example.com/api/reminders", {
        method: "POST",
        body: cuerpo,
        headers: firma ? { "upstash-signature": firma } : {},
    })
}

let verificarFirmaQstash: typeof import("./firma").verificarFirmaQstash

beforeAll(async () => {
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", LLAVE_ACTUAL)
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", LLAVE_SIGUIENTE)
    ;({ verificarFirmaQstash } = await import("./firma"))
})

afterAll(() => {
    vi.unstubAllEnvs()
})

describe("verificarFirmaQstash", () => {
    const cuerpo = JSON.stringify({ citaId: "c1", tipo: "24h" })

    it("acepta una firma válida y devuelve el cuerpo crudo", async () => {
        expect(await verificarFirmaQstash(peticion(cuerpo, firmar(cuerpo, LLAVE_ACTUAL)))).toEqual({ ok: true, cuerpo })
    })

    it("acepta la llave siguiente (rotación de llaves)", async () => {
        const r = await verificarFirmaQstash(peticion(cuerpo, firmar(cuerpo, LLAVE_SIGUIENTE)))
        expect(r.ok).toBe(true)
    })

    it("rechaza si falta la cabecera", async () => {
        expect(await verificarFirmaQstash(peticion(cuerpo))).toEqual({ ok: false })
    })

    it("rechaza una firma con otra llave", async () => {
        expect(await verificarFirmaQstash(peticion(cuerpo, firmar(cuerpo, "otra-llave")))).toEqual({ ok: false })
    })

    it("rechaza si el cuerpo fue alterado", async () => {
        const firma = firmar(cuerpo, LLAVE_ACTUAL)
        expect(await verificarFirmaQstash(peticion(JSON.stringify({ citaId: "c2", tipo: "24h" }), firma))).toEqual({
            ok: false,
        })
    })

    it("rechaza una firma expirada", async () => {
        expect(await verificarFirmaQstash(peticion(cuerpo, firmar(cuerpo, LLAVE_ACTUAL, { expirado: true })))).toEqual({
            ok: false,
        })
    })
})
