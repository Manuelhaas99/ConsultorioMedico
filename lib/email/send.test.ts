import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REMITENTE_DESARROLLO } from "./remitente"
import { enviarCodigo, enviarConfirmacionCita, enviarEnlaceAcceso, EnvioCorreoError } from "./send"
import { asuntoCodigo, asuntoEnlaceAcceso } from "./templates"

const send = vi.fn()
vi.mock("./client", () => ({ getResend: () => ({ emails: { send } }) }))

beforeEach(() => {
    vi.stubEnv("EMAIL_FROM", "")
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("BETTER_AUTH_URL", "https://citas.example")
    send.mockReset()
    send.mockResolvedValue({ data: { id: "correo-1" }, error: null })
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe("correos de acceso", () => {
    it("enviarCodigo manda asunto, HTML y texto sin clave de idempotencia", async () => {
        await expect(
            enviarCodigo({ email: "ana@example.com", codigo: "123456", proposito: "verificar-correo", minutosVigencia: 10 }),
        ).resolves.toEqual({ id: "correo-1" })
        expect(send).toHaveBeenCalledTimes(1)
        const [correo, opciones] = send.mock.calls[0] ?? []
        expect(correo).toMatchObject({ from: REMITENTE_DESARROLLO, to: "ana@example.com", subject: asuntoCodigo("verificar-correo") })
        expect(correo.html).toContain("123456")
        expect(correo.text).toContain("123456")
        expect(opciones).toBeUndefined()
    })

    it("enviarEnlaceAcceso manda la URL en el HTML y en el texto", async () => {
        const url = "https://citas.example/api/auth/magic-link/verify?token=abc"
        await enviarEnlaceAcceso({ email: "ana@example.com", url, minutosVigencia: 10 })
        const [correo, opciones] = send.mock.calls[0] ?? []
        expect(correo).toMatchObject({ from: REMITENTE_DESARROLLO, to: "ana@example.com", subject: asuntoEnlaceAcceso() })
        expect(correo.html).toContain(url)
        expect(correo.text).toContain(url)
        expect(opciones).toBeUndefined()
    })

    it("no llama a Resend si la URL no es del origen de la app", async () => {
        await expect(
            enviarEnlaceAcceso({ email: "ana@example.com", url: "https://evil.example/api/auth/magic-link/verify?token=abc", minutosVigencia: 10 }),
        ).rejects.toBeInstanceOf(EnvioCorreoError)
        expect(send).not.toHaveBeenCalled()
    })

    it("si Resend devuelve un error, rechaza con EnvioCorreoError", async () => {
        send.mockResolvedValue({ data: null, error: { message: "x" } })
        await expect(
            enviarCodigo({ email: "ana@example.com", codigo: "123456", proposito: "iniciar-sesion", minutosVigencia: 10 }),
        ).rejects.toBeInstanceOf(EnvioCorreoError)
    })
})

describe("correos de citas", () => {
    it("la confirmación no manda texto plano", async () => {
        await enviarConfirmacionCita({
            email: "ana@example.com",
            estado: "pendiente",
            nombrePaciente: "Ana",
            nombreDoctor: "Dra. López",
            especialidad: "Odontología",
            fechaInicio: new Date("2026-10-12T15:00:00.000Z"),
            fechaFin: new Date("2026-10-12T15:30:00.000Z"),
        })
        const [correo] = send.mock.calls[0] ?? []
        expect(correo).not.toHaveProperty("text")
    })
})
