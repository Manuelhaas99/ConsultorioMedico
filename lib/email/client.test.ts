import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

describe("getResend", () => {
    it("importar el módulo no exige RESEND_API_KEY; se valida al primer envío", async () => {
        vi.stubEnv("RESEND_API_KEY", "")
        const { getResend } = await import("./client")
        expect(() => getResend()).toThrowError(/RESEND_API_KEY: falta/)
    })

    it("reutiliza la instancia", async () => {
        vi.stubEnv("RESEND_API_KEY", "re_prueba")
        const { getResend } = await import("./client")
        expect(getResend()).toBe(getResend())
    })
})
