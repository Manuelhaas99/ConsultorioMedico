import { describe, expect, it } from "vitest"
import { doctorPropio } from "./dto"

describe("doctorPropio", () => {
    it("omite el token y el calendario de Google", () => {
        const dto = doctorPropio({
            id: "d1",
            usuarioId: "u1",
            especialidadId: "e1",
            cedula: "1234567",
            bio: null,
            aprobado: false,
            googleCalendarId: "cal",
            googleRefreshToken: "secreto",
            creadoEn: new Date("2026-01-01T00:00:00Z"),
        })
        expect(dto).not.toHaveProperty("googleRefreshToken")
        expect(dto).not.toHaveProperty("googleCalendarId")
        expect(dto).toMatchObject({ id: "d1", cedula: "1234567", aprobado: false })
    })
})
