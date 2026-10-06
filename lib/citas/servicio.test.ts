import { beforeEach, describe, expect, it, vi } from "vitest"
import { CODIGO_VIOLACION_EXCLUSION, RESTRICCION_SIN_TRASLAPE } from "./errores"
import type { CitaRegistrada, NuevaCita } from "./repositorio"

vi.mock("./repositorio", () => ({
    citasQueTraslapan: vi.fn(),
    insertarCita: vi.fn(),
    bloqueosQueTraslapan: vi.fn(),
    franjasDelDia: vi.fn(),
}))

const repositorio = await import("./repositorio")
const { reservarCita } = await import("./servicio")

const valores: NuevaCita = {
    doctorId: "6f1c1b7e-0000-4000-8000-000000000001",
    fechaInicio: new Date("2026-10-12T15:00:00.000Z"),
    fechaFin: new Date("2026-10-12T15:30:00.000Z"),
    invitadoNombre: "Ana",
    invitadoEmail: "ana@example.com",
}

const violacionDeExclusion = () =>
    new Error("Failed query", {
        cause: Object.assign(new Error("conflicting key value"), {
            code: CODIGO_VIOLACION_EXCLUSION,
            constraint: RESTRICCION_SIN_TRASLAPE,
        }),
    })

describe("reservarCita", () => {
    beforeEach(() => {
        vi.mocked(repositorio.citasQueTraslapan).mockReset().mockResolvedValue([])
        vi.mocked(repositorio.insertarCita).mockReset()
    })

    it("registra la cita cuando el horario está libre", async () => {
        const fila = { id: "c1" } as CitaRegistrada
        vi.mocked(repositorio.insertarCita).mockResolvedValue(fila)
        await expect(reservarCita(valores)).resolves.toEqual({ ok: true, cita: fila })
    })

    it("no inserta si la verificación previa encuentra una cita activa", async () => {
        vi.mocked(repositorio.citasQueTraslapan).mockResolvedValue([
            { inicio: valores.fechaInicio, fin: valores.fechaFin, estado: "confirmada" },
        ])
        await expect(reservarCita(valores)).resolves.toEqual({ ok: false, error: "HORARIO_OCUPADO" })
        expect(repositorio.insertarCita).not.toHaveBeenCalled()
    })

    it("traduce la violación de exclusión (carrera entre reservas) a HORARIO_OCUPADO", async () => {
        vi.mocked(repositorio.insertarCita).mockRejectedValue(violacionDeExclusion())
        await expect(reservarCita(valores)).resolves.toEqual({ ok: false, error: "HORARIO_OCUPADO" })
    })

    it("propaga cualquier otro error de la base", async () => {
        const error = new Error("conexión perdida")
        vi.mocked(repositorio.insertarCita).mockRejectedValue(error)
        await expect(reservarCita(valores)).rejects.toBe(error)
    })
})
