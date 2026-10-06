import { describe, expect, it } from "vitest"
import { z } from "zod"
import { leerCuerpo, leerQuery } from "./index"

const schema = z.object({ nombre: z.string().min(1), edad: z.coerce.number().int().positive() })

describe("leerCuerpo", () => {
    it("devuelve los datos cuando el cuerpo es válido", async () => {
        const req = new Request("http://x", { method: "POST", body: JSON.stringify({ nombre: "Ana", edad: 30 }) })
        const r = await leerCuerpo(req, schema)
        expect(r).toEqual({ ok: true, data: { nombre: "Ana", edad: 30 } })
    })

    it("responde 400 con errores por campo cuando no cumple el esquema", async () => {
        const req = new Request("http://x", { method: "POST", body: JSON.stringify({ nombre: "" }) })
        const r = await leerCuerpo(req, schema)
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.response.status).toBe(400)
        const body = await r.response.json()
        expect(Object.keys(body.errores)).toEqual(expect.arrayContaining(["nombre", "edad"]))
    })

    it("responde 400 cuando el cuerpo no es JSON", async () => {
        const req = new Request("http://x", { method: "POST", body: "no-json" })
        const r = await leerCuerpo(req, schema)
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.response.status).toBe(400)
    })
})

describe("leerQuery", () => {
    it("convierte y valida query params", () => {
        const r = leerQuery(new Request("http://x/?nombre=Ana&edad=4"), schema)
        expect(r).toEqual({ ok: true, data: { nombre: "Ana", edad: 4 } })
    })
})
