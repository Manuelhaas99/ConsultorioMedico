import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DatosRecordatorio } from "./repositorio"
import type { MensajeRecordatorio } from "./schemas"

vi.mock("./repositorio", () => ({
    datosParaRecordatorio: vi.fn(),
    reservarEnvio: vi.fn(),
    liberarEnvio: vi.fn(),
}))
vi.mock("@/lib/email/send", () => ({ enviarRecordatorioCita: vi.fn() }))

const repositorio = await import("./repositorio")
const { enviarRecordatorioCita } = await import("@/lib/email/send")
const { procesarRecordatorio } = await import("./servicio")

const CITA_ID = "6f1c1b7e-0000-4000-8000-000000000001"
const inicio = new Date("2026-10-12T15:00:00.000Z")

const datos: DatosRecordatorio = {
    id: CITA_ID,
    estado: "confirmada",
    fechaInicio: inicio,
    fechaFin: new Date("2026-10-12T15:30:00.000Z"),
    recordatorio24hEnviado: false,
    recordatorio1hEnviado: false,
    emailDestinatario: "ana@example.com",
    nombrePaciente: "Ana",
    nombreDoctor: "Dra. López",
    especialidad: "Ortodoncia",
    direccion: "Consultorio Centro, Av. Juárez 10, CDMX",
    invitado: false,
}
const mensaje: MensajeRecordatorio = { citaId: CITA_ID, tipo: "24h", fechaInicio: new Date(inicio) }

beforeEach(() => {
    vi.mocked(repositorio.datosParaRecordatorio).mockReset().mockResolvedValue(datos)
    vi.mocked(repositorio.reservarEnvio).mockReset().mockResolvedValue(true)
    vi.mocked(repositorio.liberarEnvio).mockReset().mockResolvedValue()
    vi.mocked(enviarRecordatorioCita).mockReset().mockResolvedValue({ id: "email_1" })
})

describe("procesarRecordatorio", () => {
    it("reserva el envío antes de mandar el correo, al destinatario de la base", async () => {
        await expect(procesarRecordatorio(mensaje)).resolves.toEqual({ enviado: true })
        expect(repositorio.reservarEnvio).toHaveBeenCalledWith(CITA_ID, "24h", mensaje.fechaInicio)
        const reserva = vi.mocked(repositorio.reservarEnvio).mock.invocationCallOrder[0]
        const envio = vi.mocked(enviarRecordatorioCita).mock.invocationCallOrder[0]
        expect(reserva).toBeLessThan(envio ?? 0)
        expect(enviarRecordatorioCita).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "ana@example.com",
                especialidad: "Ortodoncia",
                direccion: "Consultorio Centro, Av. Juárez 10, CDMX",
                tiempoRestante: "24h",
                idempotencyKey: `recordatorio-${CITA_ID}-24h-${inicio.getTime()}`,
            }),
        )
        expect(repositorio.liberarEnvio).not.toHaveBeenCalled()
    })

    it("no envía si otra entrega del mismo mensaje ya reservó el envío", async () => {
        vi.mocked(repositorio.reservarEnvio).mockResolvedValue(false)
        await expect(procesarRecordatorio(mensaje)).resolves.toEqual({ enviado: false, motivo: "YA_ENVIADO" })
        expect(enviarRecordatorioCita).not.toHaveBeenCalled()
    })

    it("revierte la marca y relanza si el correo falla, para que QStash reintente", async () => {
        const fallo = new Error("Resend caído")
        vi.mocked(enviarRecordatorioCita).mockRejectedValue(fallo)
        await expect(procesarRecordatorio(mensaje)).rejects.toBe(fallo)
        expect(repositorio.liberarEnvio).toHaveBeenCalledWith(CITA_ID, "24h")
    })

    it("omite sin tocar la base si la cita se reprogramó", async () => {
        vi.mocked(repositorio.datosParaRecordatorio).mockResolvedValue({
            ...datos,
            fechaInicio: new Date("2026-10-13T15:00:00.000Z"),
        })
        await expect(procesarRecordatorio(mensaje)).resolves.toEqual({ enviado: false, motivo: "HORARIO_CAMBIADO" })
        expect(repositorio.reservarEnvio).not.toHaveBeenCalled()
        expect(enviarRecordatorioCita).not.toHaveBeenCalled()
    })

    it("omite una cita cancelada", async () => {
        vi.mocked(repositorio.datosParaRecordatorio).mockResolvedValue({ ...datos, estado: "cancelada" })
        await expect(procesarRecordatorio(mensaje)).resolves.toEqual({ enviado: false, motivo: "CITA_INACTIVA" })
        expect(enviarRecordatorioCita).not.toHaveBeenCalled()
    })

    it("omite si la cita no existe", async () => {
        vi.mocked(repositorio.datosParaRecordatorio).mockResolvedValue(undefined)
        await expect(procesarRecordatorio(mensaje)).resolves.toEqual({ enviado: false, motivo: "NO_ENCONTRADA" })
    })
})
