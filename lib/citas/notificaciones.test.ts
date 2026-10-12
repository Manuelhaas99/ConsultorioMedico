import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CitaCreada } from "./confirmacion"

vi.mock("@/lib/email/send", () => ({ enviarConfirmacionCita: vi.fn() }))
vi.mock("@/lib/queue/reminders", () => ({ programarRecordatorios: vi.fn() }))

const { enviarConfirmacionCita } = await import("@/lib/email/send")
const { programarRecordatorios } = await import("@/lib/queue/reminders")
const { notificarCitaCreada } = await import("./notificaciones")

const creada: CitaCreada & { cita: { id: string } } = {
    cita: {
        id: "c1",
        estado: "pendiente",
        fechaInicio: new Date("2026-10-12T15:00:00.000Z"),
        fechaFin: new Date("2026-10-12T15:30:00.000Z"),
    },
    doctor: { nombre: "Dra. López", especialidad: "Ortodoncia" },
    ubicacion: null,
    contacto: { nombre: "Ana", email: "ana@example.com" },
    tokenGestion: null,
}

beforeEach(() => {
    vi.mocked(enviarConfirmacionCita).mockReset().mockResolvedValue({ id: "e1" })
    vi.mocked(programarRecordatorios).mockReset().mockResolvedValue()
    vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("notificarCitaCreada", () => {
    it("envía la confirmación con la especialidad real y programa los recordatorios", async () => {
        await notificarCitaCreada(creada)
        expect(enviarConfirmacionCita).toHaveBeenCalledWith(
            expect.objectContaining({ especialidad: "Ortodoncia", estado: "pendiente", email: "ana@example.com" }),
        )
        expect(programarRecordatorios).toHaveBeenCalledWith({ citaId: "c1", fechaInicio: creada.cita.fechaInicio })
    })

    it("un fallo de correo o de QStash no se propaga (la cita ya existe)", async () => {
        vi.mocked(enviarConfirmacionCita).mockRejectedValue(new Error("Resend"))
        vi.mocked(programarRecordatorios).mockRejectedValue(new Error("QStash"))
        await expect(notificarCitaCreada(creada)).resolves.toBeUndefined()
        expect(console.error).toHaveBeenCalledTimes(2)
    })
})
