import { describe, expect, it } from "vitest"
import { citaParaPaciente, citaParaPersonal, citaParaRol } from "./dto"
import type { CitaRegistrada } from "./repositorio"

const fila: CitaRegistrada = {
    id: "c1",
    doctorId: "d1",
    pacienteId: null,
    ubicacionId: null,
    tipoConsultaId: null,
    invitadoNombre: "Ana",
    invitadoEmail: "ana@example.com",
    invitadoTelefono: null,
    fechaInicio: new Date("2026-10-12T15:00:00Z"),
    fechaFin: new Date("2026-10-12T15:30:00Z"),
    estado: "pendiente",
    motivoConsulta: "Dolor",
    notas: "Nota interna",
    googleCalendarEventId: "evt",
    tokenGestionHash: "a".repeat(64),
    recordatorio24hEnviado: false,
    recordatorio1hEnviado: false,
    asistio: null,
    creadoEn: new Date("2026-10-01T00:00:00Z"),
    actualizadoEn: new Date("2026-10-01T00:00:00Z"),
}

describe("DTO de cita", () => {
    it("nunca expone el hash del token ni el evento de calendario", () => {
        for (const dto of [citaParaPaciente(fila), citaParaPersonal(fila)]) {
            expect(dto).not.toHaveProperty("tokenGestionHash")
            expect(dto).not.toHaveProperty("googleCalendarEventId")
        }
    })

    it("las notas internas solo las ve el personal", () => {
        expect(citaParaRol(fila, "paciente")).not.toHaveProperty("notas")
        expect(citaParaRol(fila, "personal")).toMatchObject({ notas: "Nota interna" })
    })
})
