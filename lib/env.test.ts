import { describe, expect, it } from "vitest"
import { ConfiguracionEntornoError, leerEntorno } from "./env"

describe("leerEntorno", () => {
    it("devuelve solo las variables del grupo pedido", () => {
        const r = leerEntorno("resend", { RESEND_API_KEY: "re_123", QSTASH_TOKEN: "otro" })
        expect(r).toEqual({ RESEND_API_KEY: "re_123" })
    })

    it("nombra las variables faltantes sin exponer valores", () => {
        expect(() => leerEntorno("qstashFirma", { QSTASH_CURRENT_SIGNING_KEY: "secreto-actual" })).toThrowError(
            ConfiguracionEntornoError,
        )
        try {
            leerEntorno("qstashFirma", { QSTASH_CURRENT_SIGNING_KEY: "secreto-actual" })
        } catch (error) {
            expect(String(error)).toContain("QSTASH_NEXT_SIGNING_KEY: falta")
            expect(String(error)).not.toContain("secreto-actual")
        }
    })

    it("trata los valores vacíos como ausentes", () => {
        expect(() => leerEntorno("resend", { RESEND_API_KEY: "  " })).toThrowError(/RESEND_API_KEY: falta/)
    })

    it("no depende de que el grupo no pedido esté completo", () => {
        expect(leerEntorno("app", { BETTER_AUTH_URL: "https://citas.example.com" })).toEqual({
            BETTER_AUTH_URL: "https://citas.example.com",
        })
    })

    it("valida formato de URL y longitud del secreto", () => {
        expect(() =>
            leerEntorno("auth", { BETTER_AUTH_SECRET: "corto", BETTER_AUTH_URL: "no-es-url" }),
        ).toThrowError(/BETTER_AUTH_SECRET: debe tener al menos 32 caracteres.*BETTER_AUTH_URL/)
    })

    it("Google es opcional pero sus dos variables van juntas", () => {
        const base = { BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: "http://localhost:3000" }
        expect(leerEntorno("auth", { ...base, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" })).toEqual(base)
        expect(() => leerEntorno("auth", { ...base, GOOGLE_CLIENT_ID: "id" })).toThrowError(/GOOGLE_CLIENT_SECRET/)
    })

    it("acepta QSTASH_URL opcional", () => {
        expect(leerEntorno("qstashPublicacion", { QSTASH_TOKEN: "t" })).toEqual({ QSTASH_TOKEN: "t" })
        expect(() => leerEntorno("qstashPublicacion", { QSTASH_TOKEN: "t", QSTASH_URL: "ftp://x" })).toThrowError(
            /QSTASH_URL/,
        )
    })

    it("convierte DATABASE_POOL_MAX a número y rechaza valores inválidos", () => {
        const url = "postgres://localhost/x"
        expect(leerEntorno("baseDatos", { DATABASE_URL: url, DATABASE_POOL_MAX: "8" }).DATABASE_POOL_MAX).toBe(8)
        expect(leerEntorno("baseDatos", { DATABASE_URL: url }).DATABASE_POOL_MAX).toBeUndefined()
        expect(() => leerEntorno("baseDatos", { DATABASE_URL: url, DATABASE_POOL_MAX: "0" })).toThrowError(/DATABASE_POOL_MAX/)
        expect(() => leerEntorno("baseDatos", { DATABASE_URL: url, DATABASE_POOL_MAX: "muchas" })).toThrowError(
            /DATABASE_POOL_MAX/,
        )
    })
})
