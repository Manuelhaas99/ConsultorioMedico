import { describe, expect, it } from "vitest"
import { bloqueoParaVista, doctorPropio, doctorPublico, perfilDoctor, type FilasPerfil } from "./dto"

const filaDirectorio = {
    id: "d1",
    bio: "Ortodoncista",
    cedula: "1234567",
    especialidadId: "e1",
    aprobado: true,
    especialidadNombre: "Ortodoncia",
    nombre: "Dra. Ruiz",
    imagen: null,
}

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

describe("doctorPublico", () => {
    it("no expone correo, usuario ni estado de aprobación aunque la fila los traiga", () => {
        const fila = { ...filaDirectorio, email: "doctora@personal.mx", usuarioId: "u1", googleRefreshToken: "x" }
        const dto = doctorPublico(fila)
        expect(Object.keys(dto).sort()).toEqual(
            ["bio", "cedula", "especialidadId", "especialidadNombre", "id", "imagen", "nombre"].sort(),
        )
        expect(JSON.stringify(dto)).not.toContain("doctora@personal.mx")
    })
})

describe("perfilDoctor", () => {
    const filas: FilasPerfil = {
        doctor: { ...filaDirectorio, aprobado: false },
        ubicaciones: [
            {
                id: "ub1",
                doctorId: "d1",
                nombre: "Centro",
                direccion: "Av. Juárez 1",
                ciudad: "Puebla",
                colonia: null,
                urlMapa: null,
                creadoEn: new Date(),
            },
        ],
        disponibilidad: [
            { id: "dis1", doctorId: "d1", ubicacionId: "ub1", diaSemana: "lunes", horaInicio: "09:00:00", horaFin: "14:00:00" },
        ],
        tiposConsulta: [{ id: "t1", doctorId: "d1", nombre: "Limpieza", duracionMinutos: 45, creadoEn: new Date() }],
    }

    it("la vista pública no incluye el estado de aprobación ni ids internos", () => {
        const dto = perfilDoctor(filas, "publica")
        expect(dto).not.toHaveProperty("aprobado")
        expect(dto.ubicaciones[0]).not.toHaveProperty("doctorId")
        expect(dto.ubicaciones[0]).not.toHaveProperty("creadoEn")
        expect(dto.tiposConsulta[0]).toEqual({ id: "t1", nombre: "Limpieza", duracionMinutos: 45 })
        expect(dto.disponibilidad[0]).not.toHaveProperty("doctorId")
    })

    it("el dueño y el admin ven si está aprobado", () => {
        expect(perfilDoctor(filas, "personal").aprobado).toBe(false)
        expect(perfilDoctor(filas, "admin").aprobado).toBe(false)
    })
})

describe("bloqueoParaVista", () => {
    const bloqueo = {
        id: "b1",
        doctorId: "d1",
        fechaInicio: new Date("2026-10-12T15:00:00Z"),
        fechaFin: new Date("2026-10-12T17:00:00Z"),
        motivo: "Cita médica personal",
        creadoEn: new Date("2026-10-01T00:00:00Z"),
    }

    it("el público y el admin solo ven el intervalo", () => {
        expect(bloqueoParaVista(bloqueo, "publica")).toEqual({ fechaInicio: bloqueo.fechaInicio, fechaFin: bloqueo.fechaFin })
        expect(bloqueoParaVista(bloqueo, "admin")).not.toHaveProperty("motivo")
    })

    it("el personal del doctor ve el motivo", () => {
        expect(bloqueoParaVista(bloqueo, "personal")).toMatchObject({ id: "b1", motivo: "Cita médica personal" })
    })
})
