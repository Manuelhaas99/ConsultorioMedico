import { beforeEach, describe, expect, it, vi } from "vitest"
import { REMITENTE_DESARROLLO } from "@/lib/email/remitente"
import { asuntoCodigo, asuntoEnlaceAcceso } from "@/lib/email/templates"

const enviarResend = vi.fn()
vi.mock("@/lib/email/client", () => ({ getResend: () => ({ emails: { send: enviarResend } }) }))
vi.mock("@/lib/env", () => ({
    env: (grupo: string) => (grupo === "app" ? { BETTER_AUTH_URL: "https://citas.example" } : {}),
}))

const { enviarCodigo, enviarConfirmacionCita, enviarEnlaceAcceso, EnvioCorreoError } = await import("@/lib/email/send")

const cita = {
    email: "ana@example.com",
    estado: "pendiente" as const,
    nombrePaciente: "Ana",
    nombreDoctor: "Dra. López",
    especialidad: "Ortodoncia",
    fechaInicio: new Date("2026-10-12T15:00:00Z"),
    fechaFin: new Date("2026-10-12T15:30:00Z"),
}

beforeEach(() => {
    enviarResend.mockReset().mockResolvedValue({ data: { id: "m1" }, error: null })
})

describe("enviarConfirmacionCita", () => {
    it("arma el enlace de gestión con la URL validada de la app", async () => {
        await enviarConfirmacionCita({ ...cita, tokenGestion: "abc" })

        expect(enviarResend.mock.calls[0]?.[0].html).toContain('href="https://citas.example/cita#token=abc"')
    })

    it("no manda texto plano", async () => {
        await enviarConfirmacionCita(cita)

        expect(enviarResend.mock.calls[0]?.[0]).not.toHaveProperty("text")
    })
})

describe("correos de acceso", () => {
    it("enviarCodigo manda asunto, HTML y texto sin clave de idempotencia", async () => {
        await expect(
            enviarCodigo({ email: "ana@example.com", codigo: "123456", proposito: "verificar-correo", minutosVigencia: 10 }),
        ).resolves.toEqual({ id: "m1" })
        expect(enviarResend).toHaveBeenCalledTimes(1)
        const [correo, opciones] = enviarResend.mock.calls[0] ?? []
        expect(correo).toMatchObject({ from: REMITENTE_DESARROLLO, to: "ana@example.com", subject: asuntoCodigo("verificar-correo") })
        expect(correo.html).toContain("123456")
        expect(correo.text).toContain("123456")
        expect(opciones).toBeUndefined()
    })

    it("enviarEnlaceAcceso manda la URL en el HTML y en el texto", async () => {
        const url = "https://citas.example/api/auth/magic-link/verify?token=abc"
        await enviarEnlaceAcceso({ email: "ana@example.com", url, minutosVigencia: 10 })
        const [correo, opciones] = enviarResend.mock.calls[0] ?? []
        expect(correo).toMatchObject({ from: REMITENTE_DESARROLLO, to: "ana@example.com", subject: asuntoEnlaceAcceso() })
        expect(correo.html).toContain(url)
        expect(correo.text).toContain(url)
        expect(opciones).toBeUndefined()
    })

    it("no llama a Resend si la URL no es del origen de la app", async () => {
        await expect(
            enviarEnlaceAcceso({ email: "ana@example.com", url: "https://evil.example/api/auth/magic-link/verify?token=abc", minutosVigencia: 10 }),
        ).rejects.toBeInstanceOf(EnvioCorreoError)
        expect(enviarResend).not.toHaveBeenCalled()
    })

    it("si Resend devuelve un error, rechaza con EnvioCorreoError", async () => {
        enviarResend.mockResolvedValue({ data: null, error: { message: "x" } })
        await expect(
            enviarCodigo({ email: "ana@example.com", codigo: "123456", proposito: "iniciar-sesion", minutosVigencia: 10 }),
        ).rejects.toBeInstanceOf(EnvioCorreoError)
    })
})
