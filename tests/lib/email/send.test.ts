import { beforeEach, describe, expect, it, vi } from "vitest"

const enviarResend = vi.fn()
vi.mock("@/lib/email/client", () => ({ getResend: () => ({ emails: { send: enviarResend } }) }))
vi.mock("@/lib/env", () => ({
    env: (grupo: string) => (grupo === "app" ? { BETTER_AUTH_URL: "https://citas.example" } : {}),
}))

const { enviarConfirmacionCita } = await import("@/lib/email/send")

beforeEach(() => {
    enviarResend.mockReset().mockResolvedValue({ data: { id: "m1" }, error: null })
})

describe("enviarConfirmacionCita", () => {
    it("arma el enlace de gestión con la URL validada de la app", async () => {
        await enviarConfirmacionCita({
            email: "ana@example.com",
            estado: "pendiente",
            nombrePaciente: "Ana",
            nombreDoctor: "Dra. López",
            especialidad: "Ortodoncia",
            fechaInicio: new Date("2026-10-12T15:00:00Z"),
            fechaFin: new Date("2026-10-12T15:30:00Z"),
            tokenGestion: "abc",
        })

        expect(enviarResend.mock.calls[0]?.[0].html).toContain('href="https://citas.example/cita#token=abc"')
    })
})
