import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { generarTokenGestion, hashTokenGestion, tokenGestionSchema } from "./token"

describe("token de gestión", () => {
    it("genera tokens de 256 bits en base64url, distintos cada vez", () => {
        const a = generarTokenGestion()
        const b = generarTokenGestion()
        expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(a.token).not.toBe(b.token)
    })

    it("devuelve el SHA-256 hexadecimal del token, nunca el token", () => {
        const { token, hash } = generarTokenGestion()
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
        expect(hash).not.toContain(token)
        expect(hash).toBe(hashTokenGestion(token))
    })

    it("coincide con sha256(convert_to(token, 'UTF8')) de Postgres (migración 0004)", () => {
        // Valor calculado con: select encode(sha256(convert_to('abc', 'UTF8')), 'hex')
        expect(hashTokenGestion("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        expect(hashTokenGestion("abc")).toBe(createHash("sha256").update("abc").digest("hex"))
    })

    it("acepta tokens nuevos y heredados (hex de 64) y rechaza otros textos", () => {
        expect(tokenGestionSchema.safeParse(generarTokenGestion().token).success).toBe(true)
        expect(tokenGestionSchema.safeParse("a".repeat(64)).success).toBe(true)
        for (const malo of ["", "corto", "con espacios y más de treinta y dos caracteres", "x".repeat(129), "abc%2F".repeat(8)]) {
            expect(tokenGestionSchema.safeParse(malo).success).toBe(false)
        }
    })
})
