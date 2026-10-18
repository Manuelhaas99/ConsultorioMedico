import { describe, expect, it } from "vitest"
import { crearBloqueoSchema, crearDisponibilidadSchema, listarDoctoresQuerySchema, registrarDoctorSchema } from "./schemas"

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

describe("listarDoctoresQuerySchema", () => {
    it("acepta filtros vacíos", () => {
        expect(listarDoctoresQuerySchema.parse({})).toEqual({})
        expect(listarDoctoresQuerySchema.parse({ ciudad: "   " })).toEqual({ ciudad: undefined })
    })

    it("normaliza la ciudad y valida la especialidad", () => {
        expect(listarDoctoresQuerySchema.parse({ especialidad: especialidadId, ciudad: " Puebla " })).toEqual({
            especialidad: especialidadId,
            ciudad: "Puebla",
        })
        expect(listarDoctoresQuerySchema.safeParse({ especialidad: "ortodoncia" }).success).toBe(false)
    })
})

describe("crearDisponibilidadSchema", () => {
    const base = { diaSemana: "lunes", horaInicio: "09:00", horaFin: "14:30" }

    it("normaliza las horas a HH:MM:SS", () => {
        expect(crearDisponibilidadSchema.parse(base)).toEqual({
            diaSemana: "lunes",
            horaInicio: "09:00:00",
            horaFin: "14:30:00",
        })
    })

    it("rechaza fin igual o anterior al inicio, horas mal formadas y días inventados", () => {
        expect(crearDisponibilidadSchema.safeParse({ ...base, horaFin: "09:00" }).success).toBe(false)
        expect(crearDisponibilidadSchema.safeParse({ ...base, horaFin: "08:00:00" }).success).toBe(false)
        expect(crearDisponibilidadSchema.safeParse({ ...base, horaInicio: "9am" }).success).toBe(false)
        expect(crearDisponibilidadSchema.safeParse({ ...base, horaFin: "25:00" }).success).toBe(false)
        expect(crearDisponibilidadSchema.safeParse({ ...base, diaSemana: "monday" }).success).toBe(false)
        expect(crearDisponibilidadSchema.safeParse({ ...base, ubicacionId: "x" }).success).toBe(false)
    })
})

describe("crearBloqueoSchema", () => {
    const base = { fechaInicio: "2026-10-12T09:00:00-06:00", fechaFin: "2026-10-12T11:00:00-06:00" }

    it("convierte a Date y trata el motivo vacío como ausente", () => {
        const r = crearBloqueoSchema.parse({ ...base, motivo: "  " })
        expect(r.fechaInicio).toEqual(new Date("2026-10-12T15:00:00Z"))
        expect(r.motivo).toBeNull()
    })

    it("rechaza fechas inválidas, sin zona o con fin no posterior al inicio", () => {
        expect(crearBloqueoSchema.safeParse({ ...base, fechaInicio: "basura" }).success).toBe(false)
        expect(crearBloqueoSchema.safeParse({ ...base, fechaInicio: "2026-10-12T09:00:00" }).success).toBe(false)
        expect(crearBloqueoSchema.safeParse({ ...base, fechaFin: base.fechaInicio }).success).toBe(false)
        expect(crearBloqueoSchema.safeParse({ fechaInicio: base.fechaFin, fechaFin: base.fechaInicio }).success).toBe(false)
    })
})
