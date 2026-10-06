import { afterEach, describe, expect, it } from "vitest"
import { templateConfirmacionCita, templateRecordatorioCita } from "./templates"

const base = {
    nombrePaciente: "Ana",
    nombreDoctor: "Dra. López",
    especialidad: "Odontología",
    fechaInicio: new Date("2026-10-12T15:00:00.000Z"),
    fechaFin: new Date("2026-10-12T15:30:00.000Z"),
}

const tzOriginal = process.env.TZ
afterEach(() => {
    process.env.TZ = tzOriginal
})

describe("correos de citas en la zona del consultorio", () => {
    it.each(["UTC", "America/Mexico_City", "Asia/Tokyo"])("la confirmación muestra 09:00–09:30 con TZ=%s", (tz) => {
        process.env.TZ = tz
        const html = templateConfirmacionCita(base)
        expect(html).toContain("lunes, 12 de octubre de 2026")
        expect(html).toContain("09:00 - 09:30")
    })

    it.each(["UTC", "America/Mexico_City", "Asia/Tokyo"])("el recordatorio muestra 09:00 con TZ=%s", (tz) => {
        process.env.TZ = tz
        const html = templateRecordatorioCita({ ...base, tiempoRestante: "1h", citaId: "c1" })
        expect(html).toContain("lunes, 12 de octubre de 2026")
        expect(html).toContain("<strong>Hora:</strong> 09:00")
    })
})
