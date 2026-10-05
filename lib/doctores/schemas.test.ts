import { describe, expect, it } from "vitest"
import { registrarDoctorSchema } from "./schemas"

const especialidadId = "6f1c1b7e-0000-4000-8000-000000000001"

describe("registrarDoctorSchema", () => {
    it("acepta y normaliza una solicitud válida", () => {
        const r = registrarDoctorSchema.parse({ especialidadId, cedula: " 1234567 ", bio: "  " })
        expect(r).toEqual({ especialidadId, cedula: "1234567", bio: null })
    })

    it("ignora campos extra como aprobado o rol", () => {
        const r = registrarDoctorSchema.parse({ especialidadId, cedula: "1234567", aprobado: true, rol: "admin" })
        expect(r).not.toHaveProperty("aprobado")
        expect(r).not.toHaveProperty("rol")
    })

    it("rechaza cédula o especialidad inválidas", () => {
        expect(registrarDoctorSchema.safeParse({ especialidadId, cedula: "" }).success).toBe(false)
        expect(registrarDoctorSchema.safeParse({ especialidadId, cedula: "<script>" }).success).toBe(false)
        expect(registrarDoctorSchema.safeParse({ especialidadId: "x", cedula: "1234567" }).success).toBe(false)
        expect(registrarDoctorSchema.safeParse({ cedula: 1234567, especialidadId }).success).toBe(false)
    })
})
