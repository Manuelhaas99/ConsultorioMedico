import { describe, expect, it } from "vitest"
import type { EstadoCita } from "./intervalos"
import { puedeEditar, puedeVer, rolEnCita, transicionValida, type CitaParaPolitica, type HechosDeAcceso } from "./politica"

const ahora = new Date("2026-10-10T12:00:00Z")
const futura: CitaParaPolitica = { pacienteId: "pac", estado: "pendiente", fechaInicio: new Date("2026-10-12T15:00:00Z") }
const sinRelacion: HechosDeAcceso = { usuarioId: null, esPersonal: false, tokenValido: false }

describe("rolEnCita / puedeVer", () => {
    it("el paciente dueño con sesión es paciente", () => {
        expect(rolEnCita(futura, { ...sinRelacion, usuarioId: "pac" })).toBe("paciente")
    })

    it("quien presenta el token válido es paciente", () => {
        expect(rolEnCita(futura, { ...sinRelacion, tokenValido: true })).toBe("paciente")
    })

    it("el doctor dueño o su secretario es personal (aunque también sea el paciente)", () => {
        expect(rolEnCita(futura, { ...sinRelacion, usuarioId: "doc", esPersonal: true })).toBe("personal")
        expect(rolEnCita(futura, { ...sinRelacion, usuarioId: "pac", esPersonal: true })).toBe("personal")
    })

    it("otro usuario con sesión no tiene acceso", () => {
        const rol = rolEnCita(futura, { ...sinRelacion, usuarioId: "otro" })
        expect(rol).toBeNull()
        expect(puedeVer(rol)).toBe(false)
    })

    it("una cita de invitado no coincide con un usuario cualquiera", () => {
        expect(rolEnCita({ ...futura, pacienteId: null }, { ...sinRelacion, usuarioId: "otro" })).toBeNull()
    })
})

describe("puedeEditar: paciente (sesión o token)", () => {
    it("puede cancelar y editar el motivo de una cita futura pendiente o confirmada", () => {
        expect(puedeEditar("paciente", futura, { estado: "cancelada" }, ahora)).toBeNull()
        expect(puedeEditar("paciente", futura, { motivoConsulta: "Dolor de muela" }, ahora)).toBeNull()
        expect(puedeEditar("paciente", { ...futura, estado: "confirmada" }, { estado: "cancelada" }, ahora)).toBeNull()
    })

    it.each<EstadoCita>(["confirmada", "completada", "no_show", "pendiente"])("no puede poner el estado %s", (estado) => {
        expect(puedeEditar("paciente", futura, { estado }, ahora)).toBe("CAMBIO_NO_PERMITIDO")
    })

    it("no puede escribir notas", () => {
        expect(puedeEditar("paciente", futura, { notas: "hola" }, ahora)).toBe("CAMBIO_NO_PERMITIDO")
        expect(puedeEditar("paciente", futura, { notas: null }, ahora)).toBe("CAMBIO_NO_PERMITIDO")
    })

    it.each<EstadoCita>(["cancelada", "completada", "no_show"])("no puede modificar una cita %s", (estado) => {
        expect(puedeEditar("paciente", { ...futura, estado }, { estado: "cancelada" }, ahora)).toBe("CITA_NO_EDITABLE")
        expect(puedeEditar("paciente", { ...futura, estado }, { motivoConsulta: "x" }, ahora)).toBe("CITA_NO_EDITABLE")
    })

    it("no puede modificar una cita que ya empezó o pasó", () => {
        const pasada = { ...futura, fechaInicio: ahora }
        expect(puedeEditar("paciente", pasada, { estado: "cancelada" }, ahora)).toBe("CITA_NO_EDITABLE")
    })
})

describe("puedeEditar: personal (doctor dueño o secretario)", () => {
    it.each<[EstadoCita, EstadoCita]>([
        ["pendiente", "confirmada"],
        ["pendiente", "cancelada"],
        ["confirmada", "completada"],
        ["confirmada", "no_show"],
        ["confirmada", "cancelada"],
    ])("permite %s → %s", (desde, hacia) => {
        expect(transicionValida(desde, hacia)).toBe(true)
        expect(puedeEditar("personal", { ...futura, estado: desde }, { estado: hacia }, ahora)).toBeNull()
    })

    it.each<[EstadoCita, EstadoCita]>([
        ["pendiente", "completada"],
        ["pendiente", "no_show"],
        ["pendiente", "pendiente"],
        ["confirmada", "pendiente"],
        ["cancelada", "confirmada"],
        ["completada", "cancelada"],
        ["no_show", "completada"],
    ])("rechaza %s → %s", (desde, hacia) => {
        expect(transicionValida(desde, hacia)).toBe(false)
        expect(puedeEditar("personal", { ...futura, estado: desde }, { estado: hacia }, ahora)).toBe("TRANSICION_INVALIDA")
    })

    it("puede escribir notas en cualquier estado, también en citas pasadas", () => {
        const completadaPasada = { ...futura, estado: "completada" as const, fechaInicio: new Date("2026-01-01T00:00:00Z") }
        expect(puedeEditar("personal", completadaPasada, { notas: "Resina en 36" }, ahora)).toBeNull()
    })
})

describe("puedeEditar: sin relación", () => {
    it("rechaza cualquier cambio", () => {
        expect(puedeEditar(null, futura, { estado: "cancelada" }, ahora)).toBe("NO_AUTORIZADO")
    })
})
