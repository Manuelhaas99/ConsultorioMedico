import { afterEach, describe, expect, it, vi } from "vitest"

const almacen = globalThis as typeof globalThis & { __conexionPg?: unknown }

afterEach(async () => {
    vi.unstubAllEnvs()
    vi.resetModules()
    delete almacen.__conexionPg
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

    it("en desarrollo reutiliza el mismo Pool tras una recarga del módulo", async () => {
        vi.stubEnv("NODE_ENV", "development")
        vi.stubEnv("DATABASE_URL", "postgres://app:app@localhost:5432/citas")
        vi.stubEnv("DATABASE_SSL", "disable")
        const primera = (await import("./client")).getPool()
        vi.resetModules() // simula una recarga en caliente
        const segunda = (await import("./client")).getPool()
        expect(segunda).toBe(primera)
        await primera.end()
    })

    it("en producción no guarda el Pool en globalThis", async () => {
        vi.stubEnv("NODE_ENV", "production")
        vi.stubEnv("DATABASE_URL", "postgres://app:app@localhost:5432/citas")
        vi.stubEnv("DATABASE_SSL", "disable")
        const { getPool } = await import("./client")
        const pool = getPool()
        expect(almacen.__conexionPg).toBeUndefined()
        expect(pool.options.max).toBe(5)
        await pool.end()
    })

    it("aplica DATABASE_POOL_MAX", async () => {
        vi.stubEnv("DATABASE_URL", "postgres://app:app@localhost:5432/citas")
        vi.stubEnv("DATABASE_SSL", "disable")
        vi.stubEnv("DATABASE_POOL_MAX", "3")
        const { getPool } = await import("./client")
        const pool = getPool()
        expect(pool.options.max).toBe(3)
        expect(pool.options.idleTimeoutMillis).toBe(10_000)
        await pool.end()
    })
})
