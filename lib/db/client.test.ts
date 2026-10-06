import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

describe("cliente de base de datos", () => {
    it("importar el módulo no exige DATABASE_URL (next build sin secretos)", async () => {
        vi.stubEnv("DATABASE_URL", "")
        const { db, getDb } = await import("./client")
        expect(db).toBeDefined()
        expect(() => getDb()).toThrowError(/DATABASE_URL: falta/)
    })

    it("crea el cliente al primer uso y lo reutiliza", async () => {
        vi.stubEnv("DATABASE_URL", "postgres://app:app@localhost:5432/citas")
        vi.stubEnv("DATABASE_SSL", "disable")
        const { db, getDb } = await import("./client")
        expect(getDb()).toBe(getDb())
        expect(typeof db.select).toBe("function")
    })
})
