import { describe, expect, it } from "vitest"
import { opcionesPool, POOL_MAX_POR_DEFECTO, reutilizarEnGlobal } from "./pool"

describe("opcionesPool", () => {
    it("usa pocas conexiones y las libera pronto por defecto (serverless)", () => {
        const opciones = opcionesPool()
        expect(opciones.max).toBe(POOL_MAX_POR_DEFECTO)
        expect(opciones.max).toBeLessThanOrEqual(10)
        expect(opciones.idleTimeoutMillis).toBeGreaterThan(0)
        expect(opciones.idleTimeoutMillis).toBeLessThanOrEqual(30_000)
        expect(opciones.connectionTimeoutMillis).toBeGreaterThan(0)
        expect(opciones.allowExitOnIdle).toBe(true)
    })

    it("respeta DATABASE_POOL_MAX", () => {
        expect(opcionesPool({ max: 2 }).max).toBe(2)
    })
})

describe("reutilizarEnGlobal", () => {
    it("reutiliza el Pool entre recargas fuera de producción", () => {
        expect(reutilizarEnGlobal("development")).toBe(true)
        expect(reutilizarEnGlobal("test")).toBe(true)
        expect(reutilizarEnGlobal(undefined)).toBe(true)
    })

    it("en producción no usa globalThis", () => {
        expect(reutilizarEnGlobal("production")).toBe(false)
    })
})
