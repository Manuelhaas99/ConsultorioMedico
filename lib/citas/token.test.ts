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

    it("acepta solo tokens con el formato generado", () => {
        expect(tokenGestionSchema.safeParse(generarTokenGestion().token).success).toBe(true)
        for (const malo of ["", "a".repeat(64), "corto", "con espacios y más de treinta y dos caracteres", "x".repeat(129), "abc%2F".repeat(8)]) {
            expect(tokenGestionSchema.safeParse(malo).success).toBe(false)
        }
    })
})
